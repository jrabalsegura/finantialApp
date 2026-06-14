"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/domain/financial-calculations";
import {
  getConvertReimbursementToExpenseRules,
  getQuickTransactionRules,
  getReimbursementTransactionRules,
  type QuickTransactionType
} from "@/domain/transaction-rules";

export type TransactionFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

const VALID_QUICK_TRANSACTION_TYPES = new Set<QuickTransactionType>([
  "expense",
  "income",
  "transfer"
]);

export async function createQuickTransaction(
  _previousState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  try {
    const type = parseTransactionType(formData.get("type"));
    const amount = parseAmount(formData.get("amount"));
    const accountId = parseRequiredString(formData.get("accountId"));
    const destinationAccountId =
      type === "transfer"
        ? parseRequiredString(formData.get("destinationAccountId"))
        : null;
    const categoryId =
      type === "transfer"
        ? null
        : parseOptionalString(formData.get("categoryId"));
    const description = parseOptionalString(formData.get("description"));
    const date = parseTransactionDate(formData.get("date"));
    const rules = getQuickTransactionRules({
      type,
      amount,
      accountId,
      destinationAccountId
    });

    await prisma.$transaction(async (tx) => {
      await assertAccountExists(tx, accountId);

      if (destinationAccountId) {
        await assertAccountExists(tx, destinationAccountId);
      }

      if (categoryId && type !== "transfer") {
        await assertCategoryMatchesType(tx, categoryId, type);
      }

      await tx.transaction.create({
        data: {
          date,
          amount,
          type,
          description,
          accountId,
          destinationAccountId,
          categoryId,
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
    });

    revalidatePath("/");

    return {
      status: "success",
      message: "Movimiento guardado."
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el movimiento."
    };
  }
}

export async function createReimbursableExpense(
  formData: FormData
): Promise<void> {
  const amount = parseAmount(formData.get("amount"));
  const accountId = parseRequiredString(formData.get("accountId"));
  const categoryId = parseOptionalString(formData.get("categoryId"));
  const title = parseRequiredString(formData.get("title"));
  const personName = parseRequiredString(formData.get("personName"));
  const notes = parseOptionalString(formData.get("notes"));
  const dueDate = parseOptionalDate(formData.get("dueDate"));
  const date = parseTransactionDate(formData.get("date"));
  const rules = getReimbursementTransactionRules({
    type: "reimbursable_expense",
    amount,
    accountId
  });

  await prisma.$transaction(async (tx) => {
    await assertAccountExists(tx, accountId);

    if (categoryId) {
      await assertCategoryMatchesType(tx, categoryId, "expense");
    }

    const originalTransaction = await tx.transaction.create({
      data: {
        date,
        amount,
        type: "reimbursable_expense",
        description: title,
        accountId,
        categoryId,
        affectsRealBalance: rules.impact.affectsRealBalance,
        affectsPersonalExpense: rules.impact.affectsPersonalExpense,
        affectsPersonalIncome: rules.impact.affectsPersonalIncome,
        affectsMonthlySavings: rules.impact.affectsMonthlySavings,
        affectsNetWorth: rules.impact.affectsNetWorth
      }
    });

    await tx.reimbursement.create({
      data: {
        title,
        personName,
        originalTransactionId: originalTransaction.id,
        expectedAmount: amount,
        paidAmount: 0,
        status: "pending",
        dueDate,
        notes
      }
    });

    await applyBalanceDeltas(tx, rules.balanceDeltas);
  });

  revalidateReimbursementViews();
}

export async function recordReimbursementPayment(
  formData: FormData
): Promise<void> {
  const reimbursementId = parseRequiredString(formData.get("reimbursementId"));
  const accountId = parseRequiredString(formData.get("accountId"));
  const amount = parseAmount(formData.get("amount"));
  const date = parseTransactionDate(formData.get("date"));
  const rules = getReimbursementTransactionRules({
    type: "reimbursement_income",
    amount,
    accountId
  });

  await prisma.$transaction(async (tx) => {
    await assertAccountExists(tx, accountId);

    const reimbursement = await tx.reimbursement.findUnique({
      where: { id: reimbursementId },
      include: {
        originalTransaction: {
          select: {
            description: true
          }
        }
      }
    });

    if (!reimbursement) {
      throw new Error("El pendiente no existe.");
    }

    if (!["pending", "partially_paid"].includes(reimbursement.status)) {
      throw new Error("Este pendiente ya no admite cobros.");
    }

    const expectedAmount = toMoneyNumber(reimbursement.expectedAmount);
    const paidAmount = toMoneyNumber(reimbursement.paidAmount);
    const pendingAmount = expectedAmount - paidAmount;

    if (amount > pendingAmount) {
      throw new Error("El cobro no puede superar el importe pendiente.");
    }

    const newPaidAmount = paidAmount + amount;

    await tx.transaction.create({
      data: {
        date,
        amount,
        type: "reimbursement_income",
        description: `Cobro de reembolso: ${
          reimbursement.originalTransaction.description ?? reimbursement.title
        }`,
        accountId,
        reimbursementId,
        affectsRealBalance: rules.impact.affectsRealBalance,
        affectsPersonalExpense: rules.impact.affectsPersonalExpense,
        affectsPersonalIncome: rules.impact.affectsPersonalIncome,
        affectsMonthlySavings: rules.impact.affectsMonthlySavings,
        affectsNetWorth: rules.impact.affectsNetWorth
      }
    });

    await tx.reimbursement.update({
      where: { id: reimbursementId },
      data: {
        paidAmount: newPaidAmount,
        status: newPaidAmount >= expectedAmount ? "paid" : "partially_paid"
      }
    });

    await applyBalanceDeltas(tx, rules.balanceDeltas);
  });

  revalidateReimbursementViews();
}

export async function convertReimbursementToRealExpense(
  formData: FormData
): Promise<void> {
  const reimbursementId = parseRequiredString(formData.get("reimbursementId"));

  await prisma.$transaction(async (tx) => {
    const reimbursement = await tx.reimbursement.findUnique({
      where: { id: reimbursementId },
      include: {
        originalTransaction: true
      }
    });

    if (!reimbursement) {
      throw new Error("El pendiente no existe.");
    }

    if (!["pending", "partially_paid"].includes(reimbursement.status)) {
      throw new Error("Este pendiente ya no se puede convertir.");
    }

    const pendingAmount =
      toMoneyNumber(reimbursement.expectedAmount) -
      toMoneyNumber(reimbursement.paidAmount);

    if (pendingAmount <= 0) {
      throw new Error("No queda importe pendiente por convertir.");
    }

    const rules = getConvertReimbursementToExpenseRules({
      pendingAmount,
      accountId: reimbursement.originalTransaction.accountId
    });

    await tx.transaction.create({
      data: {
        date: new Date(),
        amount: pendingAmount,
        type: "expense",
        description: `Convertido en gasto real: ${reimbursement.title}`,
        accountId: reimbursement.originalTransaction.accountId,
        categoryId: reimbursement.originalTransaction.categoryId,
        affectsRealBalance: rules.impact.affectsRealBalance,
        affectsPersonalExpense: rules.impact.affectsPersonalExpense,
        affectsPersonalIncome: rules.impact.affectsPersonalIncome,
        affectsMonthlySavings: rules.impact.affectsMonthlySavings,
        affectsNetWorth: rules.impact.affectsNetWorth
      }
    });

    await tx.reimbursement.update({
      where: { id: reimbursementId },
      data: {
        status: "uncollectible"
      }
    });
  });

  revalidateReimbursementViews();
}

function parseTransactionType(value: FormDataEntryValue | null): QuickTransactionType {
  if (
    typeof value !== "string" ||
    !VALID_QUICK_TRANSACTION_TYPES.has(value as QuickTransactionType)
  ) {
    throw new Error("Tipo de movimiento no válido.");
  }

  return value as QuickTransactionType;
}

function parseAmount(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    throw new Error("Introduce un importe.");
  }

  const normalizedValue = value.replace(",", ".").trim();
  const amount = Number(normalizedValue);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }

  return amount;
}

function parseRequiredString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Faltan datos obligatorios.");
  }

  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function parseTransactionDate(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    return new Date();
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha no válida.");
  }

  return date;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return parseTransactionDate(value);
}

async function assertAccountExists(
  tx: Prisma.TransactionClient,
  accountId: string
): Promise<void> {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { id: true }
  });

  if (!account) {
    throw new Error("La cuenta seleccionada no existe.");
  }
}

async function assertCategoryMatchesType(
  tx: Prisma.TransactionClient,
  categoryId: string,
  type: Exclude<QuickTransactionType, "transfer">
): Promise<void> {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { type: true }
  });

  if (!category) {
    throw new Error("La categoría seleccionada no existe.");
  }

  if (category.type !== "both" && category.type !== type) {
    throw new Error("La categoría no corresponde al tipo de movimiento.");
  }
}

async function applyBalanceDeltas(
  tx: Prisma.TransactionClient,
  balanceDeltas: Array<{ accountId: string; delta: number }>
): Promise<void> {
  for (const balanceDelta of balanceDeltas) {
    await tx.account.update({
      where: { id: balanceDelta.accountId },
      data: {
        currentBalance: {
          increment: balanceDelta.delta
        }
      }
    });
  }
}

function revalidateReimbursementViews(): void {
  revalidatePath("/");
  revalidatePath("/reimbursements");
}
