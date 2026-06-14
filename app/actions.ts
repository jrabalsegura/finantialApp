"use server";

import { revalidatePath } from "next/cache";
import type { AccountType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getDefaultTransactionImpact,
  toMoneyNumber
} from "@/domain/financial-calculations";
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
const VALID_ACCOUNT_TYPES = new Set<AccountType>([
  "checking",
  "savings",
  "cash",
  "investment",
  "pension",
  "treasury",
  "other"
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

export async function createAccount(formData: FormData): Promise<void> {
  const name = parseRequiredString(formData.get("name"));
  const type = parseAccountType(formData.get("type"));
  const currentBalance = parseAmountAllowingZero(formData.get("currentBalance"));
  const includeInAvailableMoney = parseCheckbox(
    formData.get("includeInAvailableMoney")
  );
  const includeInNetWorth = parseCheckbox(formData.get("includeInNetWorth"));
  const includeInMonthlySavings = parseCheckbox(
    formData.get("includeInMonthlySavings")
  );
  const isDefault = parseCheckbox(formData.get("isDefault"));
  const notes = parseOptionalString(formData.get("notes"));

  await prisma.$transaction(async (tx) => {
    const accountCount = await tx.account.count();
    const shouldBeDefault = isDefault || accountCount === 0;

    if (shouldBeDefault) {
      await tx.account.updateMany({
        data: { isDefault: false }
      });
    }

    await tx.account.create({
      data: {
        name,
        type,
        currentBalance,
        includeInAvailableMoney,
        includeInNetWorth,
        includeInMonthlySavings,
        isDefault: shouldBeDefault,
        notes
      }
    });
  });

  revalidateAccountViews();
}

export async function updateAccount(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const name = parseRequiredString(formData.get("name"));
  const type = parseAccountType(formData.get("type"));
  const currentBalance = parseAmountAllowingZero(formData.get("currentBalance"));
  const includeInAvailableMoney = parseCheckbox(
    formData.get("includeInAvailableMoney")
  );
  const includeInNetWorth = parseCheckbox(formData.get("includeInNetWorth"));
  const includeInMonthlySavings = parseCheckbox(
    formData.get("includeInMonthlySavings")
  );
  const isDefault = parseCheckbox(formData.get("isDefault"));
  const notes = parseOptionalString(formData.get("notes"));

  await prisma.$transaction(async (tx) => {
    if (isDefault) {
      await tx.account.updateMany({
        where: {
          id: {
            not: id
          }
        },
        data: { isDefault: false }
      });
    }

    await tx.account.update({
      where: { id },
      data: {
        name,
        type,
        currentBalance,
        includeInAvailableMoney,
        includeInNetWorth,
        includeInMonthlySavings,
        isDefault,
        notes
      }
    });

    const defaultAccount = await tx.account.findFirst({
      where: { isDefault: true },
      select: { id: true }
    });

    if (!defaultAccount) {
      await tx.account.update({
        where: { id },
        data: { isDefault: true }
      });
    }
  });

  revalidateAccountViews();
}

export async function deleteAccount(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));

  await prisma.$transaction(async (tx) => {
    const account = await tx.account.findUnique({
      where: { id },
      select: { isDefault: true }
    });

    if (!account) {
      throw new Error("La cuenta no existe.");
    }

    const relatedTransactions = await tx.transaction.count({
      where: {
        OR: [{ accountId: id }, { destinationAccountId: id }]
      }
    });
    const relatedSnapshots = await tx.monthlyAccountSnapshot.count({
      where: { accountId: id }
    });

    if (relatedTransactions > 0 || relatedSnapshots > 0) {
      throw new Error("No se puede eliminar una cuenta con movimientos.");
    }

    await tx.account.delete({ where: { id } });

    if (account.isDefault) {
      const nextAccount = await tx.account.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true }
      });

      if (nextAccount) {
        await tx.account.update({
          where: { id: nextAccount.id },
          data: { isDefault: true }
        });
      }
    }
  });

  revalidateAccountViews();
}

export async function createSavingsBucket(formData: FormData): Promise<void> {
  const name = parseRequiredString(formData.get("name"));
  const currentAmount = parseAmountAllowingZero(formData.get("currentAmount"));
  const targetAmount = parseOptionalAmount(formData.get("targetAmount"));
  const targetDate = parseOptionalDate(formData.get("targetDate"));
  const priority = parseOptionalInteger(formData.get("priority"));
  const isLongTerm = parseCheckbox(formData.get("isLongTerm"));
  const notes = parseOptionalString(formData.get("notes"));

  await prisma.savingsBucket.create({
    data: {
      name,
      currentAmount,
      targetAmount,
      targetDate,
      priority,
      isLongTerm,
      notes
    }
  });

  revalidateSavingsViews();
}

export async function updateSavingsBucket(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const name = parseRequiredString(formData.get("name"));
  const currentAmount = parseAmountAllowingZero(formData.get("currentAmount"));
  const targetAmount = parseOptionalAmount(formData.get("targetAmount"));
  const targetDate = parseOptionalDate(formData.get("targetDate"));
  const priority = parseOptionalInteger(formData.get("priority"));
  const isLongTerm = parseCheckbox(formData.get("isLongTerm"));
  const notes = parseOptionalString(formData.get("notes"));

  await prisma.savingsBucket.update({
    where: { id },
    data: {
      name,
      currentAmount,
      targetAmount,
      targetDate,
      priority,
      isLongTerm,
      notes
    }
  });

  revalidateSavingsViews();
}

export async function deleteSavingsBucket(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));

  await prisma.$transaction(async (tx) => {
    const relatedTransactions = await tx.transaction.count({
      where: { savingsBucketId: id }
    });
    const relatedSnapshots = await tx.monthlyBucketSnapshot.count({
      where: { savingsBucketId: id }
    });

    if (relatedTransactions > 0 || relatedSnapshots > 0) {
      throw new Error("No se puede eliminar una partida con movimientos.");
    }

    await tx.savingsBucket.delete({ where: { id } });
  });

  revalidateSavingsViews();
}

export async function allocateToSavingsBucket(formData: FormData): Promise<void> {
  const savingsBucketId = parseRequiredString(formData.get("savingsBucketId"));
  const accountId = parseRequiredString(formData.get("accountId"));
  const amount = parseAmount(formData.get("amount"));
  const description =
    parseOptionalString(formData.get("description")) ?? "Asignación a ahorro";
  const impact = getDefaultTransactionImpact("savings_allocation");

  await prisma.$transaction(async (tx) => {
    await assertAccountExists(tx, accountId);
    await assertSavingsBucketExists(tx, savingsBucketId);

    await tx.savingsBucket.update({
      where: { id: savingsBucketId },
      data: {
        currentAmount: {
          increment: amount
        }
      }
    });

    await tx.transaction.create({
      data: {
        date: new Date(),
        amount,
        type: "savings_allocation",
        description,
        accountId,
        savingsBucketId,
        affectsRealBalance: impact.affectsRealBalance,
        affectsPersonalExpense: impact.affectsPersonalExpense,
        affectsPersonalIncome: impact.affectsPersonalIncome,
        affectsMonthlySavings: impact.affectsMonthlySavings,
        affectsNetWorth: impact.affectsNetWorth
      }
    });
  });

  revalidateSavingsViews();
}

export async function withdrawFromSavingsBucket(
  formData: FormData
): Promise<void> {
  const savingsBucketId = parseRequiredString(formData.get("savingsBucketId"));
  const accountId = parseRequiredString(formData.get("accountId"));
  const amount = parseAmount(formData.get("amount"));
  const description =
    parseOptionalString(formData.get("description")) ?? "Retirada de ahorro";
  const impact = getDefaultTransactionImpact("savings_withdrawal");

  await prisma.$transaction(async (tx) => {
    await assertAccountExists(tx, accountId);

    const savingsBucket = await tx.savingsBucket.findUnique({
      where: { id: savingsBucketId },
      select: {
        currentAmount: true
      }
    });

    if (!savingsBucket) {
      throw new Error("La partida de ahorro no existe.");
    }

    if (amount > toMoneyNumber(savingsBucket.currentAmount)) {
      throw new Error("No hay suficiente dinero asignado en la partida.");
    }

    await tx.savingsBucket.update({
      where: { id: savingsBucketId },
      data: {
        currentAmount: {
          decrement: amount
        }
      }
    });

    await tx.transaction.create({
      data: {
        date: new Date(),
        amount,
        type: "savings_withdrawal",
        description,
        accountId,
        savingsBucketId,
        affectsRealBalance: impact.affectsRealBalance,
        affectsPersonalExpense: impact.affectsPersonalExpense,
        affectsPersonalIncome: impact.affectsPersonalIncome,
        affectsMonthlySavings: impact.affectsMonthlySavings,
        affectsNetWorth: impact.affectsNetWorth
      }
    });
  });

  revalidateSavingsViews();
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

function parseAmountAllowingZero(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const normalizedValue = value.replace(",", ".").trim();
  const amount = Number(normalizedValue);

  if (!Number.isFinite(amount)) {
    throw new Error("El importe debe ser un número válido.");
  }

  return amount;
}

function parseOptionalAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const amount = parseAmount(value);

  return amount;
}

function parseOptionalInteger(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    throw new Error("La prioridad debe ser un número entero.");
  }

  return parsedValue;
}

function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return value === "on";
}

function parseAccountType(value: FormDataEntryValue | null): AccountType {
  if (
    typeof value !== "string" ||
    !VALID_ACCOUNT_TYPES.has(value as AccountType)
  ) {
    throw new Error("Tipo de cuenta no válido.");
  }

  return value as AccountType;
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

async function assertSavingsBucketExists(
  tx: Prisma.TransactionClient,
  savingsBucketId: string
): Promise<void> {
  const savingsBucket = await tx.savingsBucket.findUnique({
    where: { id: savingsBucketId },
    select: { id: true }
  });

  if (!savingsBucket) {
    throw new Error("La partida de ahorro no existe.");
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

function revalidateAccountViews(): void {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/reimbursements");
  revalidatePath("/savings");
}

function revalidateSavingsViews(): void {
  revalidatePath("/");
  revalidatePath("/savings");
}
