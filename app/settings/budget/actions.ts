"use server";

import type { Prisma, WeeklyBudgetCalculationMode } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { withErrorFeedback } from "@/lib/action-feedback";
import { requireCurrentUser } from "@/lib/auth";
import {
  parseCheckbox,
  parseEnum,
  parseNonNegativeAmount,
  parseOptionalString
} from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import { DEFAULT_BUDGET_SETTING_ID } from "@/lib/weekly-budget";

const CALCULATION_MODES: WeeklyBudgetCalculationMode[] = [
  "remaining_days",
  "full_month_proportional"
];

export const updateBudgetSetting = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const monthlyMinimumSavingsTarget = parseNonNegativeAmount(
      formData.get("monthlyMinimumSavingsTarget")
    );
    const weeklySpendingCap = parseNonNegativeAmount(
      formData.get("weeklySpendingCap")
    );
    const savingsBucketId = parseOptionalString(
      formData.get("savingsBucketId")
    );
    const calculationMode = parseEnum(
      formData.get("calculationMode"),
      CALCULATION_MODES,
      "Modo de cálculo no válido."
    );
    const includeReimbursableExpenses = parseCheckbox(
      formData.get("includeReimbursableExpenses")
    );
    const includePendingTransactions = parseCheckbox(
      formData.get("includePendingTransactions")
    );

    await prisma.$transaction(async (tx) => {
      await assertSavingsBucketExists(tx, savingsBucketId);
      await tx.budgetSetting.upsert({
        where: { id: DEFAULT_BUDGET_SETTING_ID },
        update: {
          weeklySpendingCap,
          monthlyMinimumSavingsTarget,
          savingsBucketId,
          calculationMode,
          includeReimbursableExpenses,
          includePendingTransactions
        },
        create: {
          id: DEFAULT_BUDGET_SETTING_ID,
          weeklySpendingCap,
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
);

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
