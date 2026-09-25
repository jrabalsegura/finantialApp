import { adjustAccountBalance, adjustBucketBalance } from "@/lib/balances";
import { assertPeriodOpen, isPeriodClosed } from "./closed-periods";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import {
  getCalendarDayRange,
  getScheduledDatesForMonth,
  getRecurringTransactionRules
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
  month: number,
  now: Date = new Date()
): Promise<string[]> {
  if (await isPeriodClosed(prisma, year, month)) return [];
  const errors: string[] = [];
  const templates = await prisma.recurringTransaction.findMany({
    where: { isActive: true }
  });
  for (const candidate of templates) {
    try {
      await prisma.$transaction(async (tx) => {
        if (await isPeriodClosed(tx, year, month)) return;
        const template = await tx.recurringTransaction.findUnique({
          where: { id: candidate.id }
        });
        if (!template?.isActive) return;
        await assertRecurringRelations(tx, template);
        const dates = getScheduledDatesForMonth(template, year, month);
        const occurrences = await tx.recurringTransactionOccurrence.findMany({
          where: { recurringTransactionId: template.id, year, month }
        });
        // A processed monthly occurrence remains the authoritative payment for that month,
        // even if the template's day has subsequently changed.
        const processedMonthly =
          template.frequency === "monthly" &&
          occurrences.some((o) => o.status !== "pending");
        for (const occurrence of occurrences.filter(
          (o) => o.status === "pending"
        )) {
          const matchesSchedule = dates.some((date) =>
            sameDay(date, occurrence.scheduledDate)
          );
          if (processedMonthly || !matchesSchedule) {
            await tx.recurringTransactionOccurrence.delete({
              where: { id: occurrence.id }
            });
          }
        }
        if (!processedMonthly)
          for (const scheduledDate of dates) {
            const existing = occurrences.find((o) =>
              sameDay(o.scheduledDate, scheduledDate)
            );
            if (existing && existing.status !== "pending") continue;
            const occurrence = existing
              ? existing.amount.equals(template.amount)
                ? existing
                : await tx.recurringTransactionOccurrence.update({
                    where: { id: existing.id },
                    data: { amount: template.amount }
                  })
              : await tx.recurringTransactionOccurrence.create({
                  data: {
                    recurringTransactionId: template.id,
                    year,
                    month,
                    scheduledDate,
                    amount: template.amount
                  }
                });
            if (
              template.autoCreateMode === "automatic" &&
              scheduledDate < getCalendarDayRange(now).end
            ) {
              await confirmRecurringOccurrenceInTransaction(tx, occurrence.id);
            }
          }
        // The worker runs every minute: skip the write when nothing changed.
        const generatedMonth = `${year}-${String(month).padStart(2, "0")}`;
        if (template.lastGeneratedMonth !== generatedMonth)
          await tx.recurringTransaction.update({
            where: { id: template.id },
            data: { lastGeneratedMonth: generatedMonth }
          });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        continue;
      const message = `${candidate.name}: ${error instanceof Error ? error.message : "No se pudo generar el movimiento."}`;
      errors.push(message);
      console.error(message);
    }
  }
  return errors;
}

function sameDay(a: Date, b: Date): boolean {
  const range = getCalendarDayRange(a);
  return b >= range.start && b < range.end;
}

/** Reconcile pending dates immediately after editing a template, preserving processed history. */
export async function reconcilePendingOccurrences(
  tx: Prisma.TransactionClient,
  recurringTransactionId: string
) {
  const template = await tx.recurringTransaction.findUniqueOrThrow({
    where: { id: recurringTransactionId }
  });
  const pending = await tx.recurringTransactionOccurrence.findMany({
    where: { recurringTransactionId, status: "pending" }
  });
  const periods = new Map(pending.map((o) => [`${o.year}-${o.month}`, o]));
  for (const { year, month } of periods.values()) {
    if (await isPeriodClosed(tx, year, month)) continue;
    const dates = getScheduledDatesForMonth(template, year, month);
    const processed = await tx.recurringTransactionOccurrence.findMany({
      where: { recurringTransactionId, year, month, status: { not: "pending" } }
    });
    await tx.recurringTransactionOccurrence.deleteMany({
      where: { recurringTransactionId, year, month, status: "pending" }
    });
    if (
      !template.isActive ||
      (template.frequency === "monthly" && processed.length > 0)
    )
      continue;
    for (const scheduledDate of dates) {
      if (processed.some((o) => sameDay(o.scheduledDate, scheduledDate)))
        continue;
      await tx.recurringTransactionOccurrence.create({
        data: {
          recurringTransactionId,
          year,
          month,
          scheduledDate,
          amount: template.amount
        }
      });
    }
  }
}

export async function processDueRecurringTransactions(
  now = new Date()
): Promise<void> {
  const templates = await prisma.recurringTransaction.findMany({
    where: { isActive: true },
    select: { startDate: true, createdAt: true, lastGeneratedMonth: true }
  });
  let first = new Date(now.getFullYear(), now.getMonth(), 1, 12);
  for (const template of templates) {
    const start = template.lastGeneratedMonth
      ? new Date(`${template.lastGeneratedMonth}-01T12:00:00`)
      : new Date(
          Math.max(template.startDate.getTime(), template.createdAt.getTime())
        );
    if (start < first)
      first = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  }
  const overdue = await prisma.recurringTransactionOccurrence.findFirst({
    where: {
      status: "pending",
      recurringTransaction: { isActive: true, autoCreateMode: "automatic" }
    },
    orderBy: { scheduledDate: "asc" }
  });
  if (overdue && overdue.scheduledDate < first)
    first = new Date(overdue.year, overdue.month - 1, 1, 12);
  for (
    const date = first;
    date < getCalendarDayRange(now).end;
    date.setMonth(date.getMonth() + 1)
  ) {
    await generateRecurringOccurrencesForMonth(
      date.getFullYear(),
      date.getMonth() + 1,
      now
    );
  }
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
  await prisma.$transaction(async (tx) => {
    const occurrence =
      await tx.recurringTransactionOccurrence.findUniqueOrThrow({
        where: { id: occurrenceId }
      });
    await assertPeriodOpen(tx, occurrence.scheduledDate);
    await tx.recurringTransactionOccurrence.update({
      where: { id: occurrenceId, status: "pending" },
      data: { status: "skipped" }
    });
  });
}

export async function confirmAllRecurringOccurrences(
  year: number,
  month: number
): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const pendingOccurrences = await tx.recurringTransactionOccurrence.findMany(
      {
        where: {
          year,
          month,
          status: "pending"
        },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
        select: { id: true }
      }
    );

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
  await assertPeriodOpen(tx, occurrence.scheduledDate);
  await assertPeriodOpen(tx, date);
  if (!template.isActive)
    throw new Error("Activa la plantilla antes de confirmar sus pendientes.");
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
    await adjustAccountBalance(tx, balanceDelta.accountId, balanceDelta.delta);
  }

  if (rules.savingsBucketDelta > 0 && template.savingsBucketId) {
    await adjustBucketBalance(
      tx,
      template.savingsBucketId,
      rules.savingsBucketDelta
    );
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
      throw new Error(
        "La transferencia recurrente no tiene cuenta de destino."
      );
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
