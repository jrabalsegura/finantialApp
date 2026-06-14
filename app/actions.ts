"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getQuickTransactionRules,
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
