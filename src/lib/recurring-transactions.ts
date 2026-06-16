import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getScheduledDatesForMonth,
  getRecurringTransactionRules,
} from "@/domain/recurring-transactions";
import { toMoneyNumber } from "@/domain/financial-calculations";

export async function getActiveRecurringTransactions() {
  return prisma.recurringTransaction.findMany({
    where: { isActive: true },
    orderBy: [
      { frequency: "asc" },
      { dayOfMonth: "asc" },
      { dayOfWeek: "asc" },
      { name: "asc" }
    ],
    include: {
      account: true,
      destinationAccount: true,
      category: true,
      savingsBucket: true
    }
  });
}

export async function generateRecurringOccurrencesForMonth(
  year: number,
  month: number
): Promise<void> {
  const templates = await prisma.recurringTransaction.findMany({
    where: { isActive: true },
    orderBy: [
      { frequency: "asc" },
      { dayOfMonth: "asc" },
      { dayOfWeek: "asc" },
      { createdAt: "asc" }
    ]
  });

  for (const template of templates) {
    const scheduledDates = getScheduledDatesForMonth(template, year, month);
    const monthlyDateCoveredByShiftedConfirmation =
      template.frequency === "monthly" && scheduledDates.length === 1
        ? await reconcileShiftedMonthlyConfirmation(
            template.id,
            year,
            month,
            scheduledDates[0]
          )
        : false;

    for (const scheduledDate of scheduledDates) {
      if (monthlyDateCoveredByShiftedConfirmation) {
        continue;
      }

      try {
        await prisma.$transaction(async (tx) => {
          const existing =
            await tx.recurringTransactionOccurrence.findUnique({
              where: {
                recurringTransactionId_scheduledDate: {
                  recurringTransactionId: template.id,
                  scheduledDate
                }
              },
              select: { id: true }
            });

          if (existing) {
            return;
          }

          const occurrence = await tx.recurringTransactionOccurrence.create({
            data: {
              recurringTransactionId: template.id,
              year,
              month,
              scheduledDate,
              amount: template.amount
            },
            select: { id: true }
          });

          await tx.recurringTransaction.update({
            where: { id: template.id },
            data: {
              lastGeneratedMonth: `${year}-${String(month).padStart(2, "0")}`
            }
          });

          if (template.autoCreateMode === "automatic") {
            await confirmRecurringOccurrenceInTransaction(tx, occurrence.id);
          }
        });
      } catch (error) {
        // La restricción única evita duplicados si dos cargas generan la misma
        // fecha recurrente a la vez.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          continue;
        }

        throw error;
      }
    }
  }
}

async function reconcileShiftedMonthlyConfirmation(
  recurringTransactionId: string,
  year: number,
  month: number,
  expectedScheduledDate: Date
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const shiftedConfirmedOccurrence =
      await tx.recurringTransactionOccurrence.findFirst({
        where: {
          recurringTransactionId,
          year,
          month,
          status: "confirmed",
          generatedTransactionId: { not: null },
          NOT: {
            scheduledDate: expectedScheduledDate
          }
        },
        select: { id: true }
      });

    if (!shiftedConfirmedOccurrence) {
      return false;
    }

    await tx.recurringTransactionOccurrence.updateMany({
      where: {
        recurringTransactionId,
        year,
        month,
        status: "pending",
        scheduledDate: expectedScheduledDate
      },
      data: {
        status: "skipped"
      }
    });

    return true;
  });
}

export async function confirmRecurringOccurrence(
  occurrenceId: string,
  changes?: { amount?: number; date?: Date }
): Promise<void> {
  await prisma.$transaction((tx) =>
    confirmRecurringOccurrenceInTransaction(tx, occurrenceId, changes)
  );
}

export async function skipRecurringOccurrence(
  occurrenceId: string
): Promise<void> {
  await prisma.recurringTransactionOccurrence.update({
    where: {
      id: occurrenceId,
      status: "pending"
    },
    data: {
      status: "skipped"
    }
  });
}

export async function confirmAllRecurringOccurrences(
  year: number,
  month: number
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const pendingOccurrences =
      await tx.recurringTransactionOccurrence.findMany({
        where: {
          year,
          month,
          status: "pending"
        },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
        select: { id: true }
      });

    for (const occurrence of pendingOccurrences) {
      await confirmRecurringOccurrenceInTransaction(tx, occurrence.id);
    }

    return pendingOccurrences.length;
  });
}

async function confirmRecurringOccurrenceInTransaction(
  tx: Prisma.TransactionClient,
  occurrenceId: string,
  changes?: { amount?: number; date?: Date }
): Promise<void> {
  const occurrence = await tx.recurringTransactionOccurrence.findUnique({
    where: { id: occurrenceId },
    include: {
      recurringTransaction: true
    }
  });

  if (!occurrence) {
    throw new Error("El movimiento recurrente pendiente no existe.");
  }

  if (occurrence.status !== "pending") {
    throw new Error("Este movimiento recurrente ya está procesado.");
  }

  const template = occurrence.recurringTransaction;
  const amount = changes?.amount ?? toMoneyNumber(occurrence.amount);
  const date = changes?.date ?? occurrence.scheduledDate;
  const rules = getRecurringTransactionRules({
    type: template.type,
    amount,
    accountId: template.accountId,
    destinationAccountId: template.destinationAccountId,
    savingsBucketId: template.savingsBucketId
  });

  await assertRecurringRelations(tx, template);

  const transaction = await tx.transaction.create({
    data: {
      date,
      amount,
      type: template.type,
      description: template.description ?? template.name,
      accountId: template.accountId,
      destinationAccountId: template.destinationAccountId,
      categoryId: template.categoryId,
      savingsBucketId: template.savingsBucketId,
      affectsRealBalance: rules.impact.affectsRealBalance,
      affectsPersonalExpense: rules.impact.affectsPersonalExpense,
      affectsPersonalIncome: rules.impact.affectsPersonalIncome,
      affectsMonthlySavings: rules.impact.affectsMonthlySavings,
      affectsNetWorth: rules.impact.affectsNetWorth
    }
  });

  for (const balanceDelta of rules.balanceDeltas) {
    await tx.account.update({
      where: { id: balanceDelta.accountId },
      data: {
        currentBalance: {
          increment: balanceDelta.delta
        }
      }
    });
  }

  if (rules.savingsBucketDelta > 0 && template.savingsBucketId) {
    await tx.savingsBucket.update({
      where: { id: template.savingsBucketId },
      data: {
        currentAmount: {
          increment: rules.savingsBucketDelta
        }
      }
    });
  }

  await tx.recurringTransactionOccurrence.update({
    where: { id: occurrence.id },
    data: {
      amount,
      status: "confirmed",
      generatedTransactionId: transaction.id
    }
  });
}

async function assertRecurringRelations(
  tx: Prisma.TransactionClient,
  template: {
    accountId: string;
    categoryId: string | null;
    destinationAccountId: string | null;
    savingsBucketId: string | null;
    type: "expense" | "income" | "transfer" | "savings_allocation";
  }
): Promise<void> {
  const account = await tx.account.findUnique({
    where: { id: template.accountId },
    select: { id: true }
  });

  if (!account) {
    throw new Error("La cuenta de origen ya no existe.");
  }

  if (template.type === "transfer") {
    if (!template.destinationAccountId) {
      throw new Error("La transferencia recurrente no tiene cuenta de destino.");
    }

    const destination = await tx.account.findUnique({
      where: { id: template.destinationAccountId },
      select: { id: true }
    });

    if (!destination) {
      throw new Error("La cuenta de destino ya no existe.");
    }
  }

  if (template.type === "savings_allocation") {
    if (!template.savingsBucketId) {
      throw new Error("La asignación recurrente no tiene partida de ahorro.");
    }

    const bucket = await tx.savingsBucket.findUnique({
      where: { id: template.savingsBucketId },
      select: { id: true, isLongTerm: true }
    });

    if (!bucket) {
      throw new Error("La partida de ahorro ya no existe.");
    }

    if (bucket.isLongTerm) {
      throw new Error(
        "La partida Largo plazo se calcula desde cuentas y no admite asignaciones recurrentes."
      );
    }
  }

  if (template.categoryId && ["expense", "income"].includes(template.type)) {
    const category = await tx.category.findUnique({
      where: { id: template.categoryId },
      select: { type: true }
    });

    if (
      !category ||
      (category.type !== "both" && category.type !== template.type)
    ) {
      throw new Error("La categoría no corresponde al tipo de movimiento.");
    }
  }
}
