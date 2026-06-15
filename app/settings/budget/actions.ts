"use server";

import {
  WeeklyBudgetCalculationMode,
  type Prisma
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { parseMoneyInput } from "@/domain/money";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BUDGET_SETTING_ID } from "@/lib/weekly-budget";

const VALID_CALCULATION_MODES = new Set<WeeklyBudgetCalculationMode>([
  "remaining_days",
  "full_month_proportional"
]);

export async function updateBudgetSetting(formData: FormData): Promise<void> {
  const monthlyMinimumSavingsTarget = parseNonNegativeAmount(
    formData.get("monthlyMinimumSavingsTarget")
  );
  const savingsBucketId = parseOptionalString(formData.get("savingsBucketId"));
  const calculationMode = parseCalculationMode(
    formData.get("calculationMode")
  );
  const includeReimbursableExpenses =
    formData.get("includeReimbursableExpenses") === "on";
  const includePendingTransactions =
    formData.get("includePendingTransactions") === "on";

  await prisma.$transaction(async (tx) => {
    await assertSavingsBucketExists(tx, savingsBucketId);
    await tx.budgetSetting.upsert({
      where: { id: DEFAULT_BUDGET_SETTING_ID },
      update: {
        monthlyMinimumSavingsTarget,
        savingsBucketId,
        calculationMode,
        includeReimbursableExpenses,
        includePendingTransactions
      },
      create: {
        id: DEFAULT_BUDGET_SETTING_ID,
        monthlyMinimumSavingsTarget,
        savingsBucketId,
        calculationMode,
        includeReimbursableExpenses,
        includePendingTransactions
      }
    });
  });

  revalidatePath("/");
  revalidatePath("/weekly-budget");
  revalidatePath("/settings/budget");
}

function parseNonNegativeAmount(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    throw new Error("Introduce el ahorro mínimo mensual.");
  }

  const amount = parseMoneyInput(value);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("El ahorro mínimo debe ser cero o mayor.");
  }

  return amount;
}

function parseCalculationMode(
  value: FormDataEntryValue | null
): WeeklyBudgetCalculationMode {
  if (
    typeof value !== "string" ||
    !VALID_CALCULATION_MODES.has(value as WeeklyBudgetCalculationMode)
  ) {
    throw new Error("Modo de cálculo no válido.");
  }

  return value as WeeklyBudgetCalculationMode;
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function assertSavingsBucketExists(
  tx: Prisma.TransactionClient,
  savingsBucketId: string | null
): Promise<void> {
  if (!savingsBucketId) return;

  const bucket = await tx.savingsBucket.findUnique({
    where: { id: savingsBucketId },
    select: { id: true }
  });
  if (!bucket) {
    throw new Error("La partida de ahorro seleccionada no existe.");
  }
}
