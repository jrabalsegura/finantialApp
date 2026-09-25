"use server";

import type { Prisma, WeeklyBudgetImpactScope } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import {
  calculateAvailableMoney,
  calculateLongTermBucketBalance,
  calculateLongTermTransferAllocation,
  calculateNetWorth,
  calculateRealMonthlyExpense,
  calculateRealMonthlyIncome,
  calculateRealMonthlySavings,
  createMonthlyBucketSnapshots,
  getDefaultTransactionImpact,
  getDeficitFunding,
  getManualMonthlyCloseResult,
  getMonthDateRange,
  toMoneyNumber,
  validateNegativeBucketReductions,
  validatePositiveBucketAllocations
} from "@/domain/financial-calculations";
import {
  ACCOUNT_TYPES,
  QUICK_TRANSACTION_TYPES,
  WEEKLY_BUDGET_IMPACT_SCOPES
} from "@/domain/domain-options";
import { normalizeMoney } from "@/domain/money";
import {
  getConvertReimbursementToExpenseRules,
  getQuickTransactionRules,
  type QuickTransactionType
} from "@/domain/transaction-rules";
import {
  getActionErrorMessage,
  withErrorFeedback
} from "@/lib/action-feedback";
import { requireCurrentUser } from "@/lib/auth";
import { adjustAccountBalance, adjustBucketBalance } from "@/lib/balances";
import { assertPeriodOpen } from "@/lib/closed-periods";
import {
  parseAmount,
  parseAmountAllowingZero,
  parseCheckbox,
  parseDateOrNow,
  parseEnum,
  parseInteger,
  parseNonNegativeAmount,
  parseOptionalDate,
  parseOptionalInteger,
  parseOptionalNonNegativeAmount,
  parseOptionalString,
  parseRequiredString
} from "@/lib/form-data";
import {
  getChangesAfter,
  getReimbursementsAt
} from "@/lib/historical-balances";
import { prisma } from "@/lib/prisma";
import { undoSavingsTransferInTransaction } from "@/lib/savings-transfers";
import {
  applyBalanceDeltas,
  assertAccountExists,
  assertCategoryMatchesType,
  assertSavingsBucketExists,
  createTransactionFromDraft
} from "@/lib/transactions";

export type TransactionFormState = {
  status: "idle" | "success" | "error";
  message: string;
};

export type MonthlyCloseFormState = TransactionFormState;

type MonthlyCloseAdjustmentKind =
  | "expense"
  | "income"
  | "technical"
  | "unassigned_savings";

type MonthlyCloseAdjustmentImpact = {
  affectsPersonalExpense: boolean;
  affectsPersonalIncome: boolean;
  affectsMonthlySavings: boolean;
  affectsNetWorth: boolean;
};

const MONTHLY_CLOSE_ADJUSTMENT_KINDS: MonthlyCloseAdjustmentKind[] = [
  "expense",
  "income",
  "technical",
  "unassigned_savings"
];
const EDITABLE_TRANSACTION_TYPES = new Set<QuickTransactionType>([
  "expense",
  "income",
  "transfer",
  "savings_allocation"
]);

export async function createQuickTransaction(
  _previousState: TransactionFormState,
  formData: FormData
): Promise<TransactionFormState> {
  await requireCurrentUser();
  try {
    const type = parseEnum(
      formData.get("type"),
      QUICK_TRANSACTION_TYPES,
      "Tipo de movimiento no válido."
    );
    const amount = parseAmount(formData.get("amount"));
    const accountId = parseRequiredString(formData.get("accountId"));
    const destinationAccountId =
      type === "transfer"
        ? parseRequiredString(formData.get("destinationAccountId"))
        : null;
    const categoryId =
      type === "expense" || type === "income" || type === "reimbursable_expense"
        ? parseOptionalString(formData.get("categoryId"))
        : null;
    const savingsBucketId =
      type === "savings_allocation"
        ? parseRequiredString(formData.get("savingsBucketId"))
        : null;
    const description = parseOptionalString(formData.get("description"));
    const date = parseDateOrNow(formData.get("date"));
    const personName =
      type === "reimbursable_expense"
        ? parseRequiredString(formData.get("personName"))
        : null;
    const reimbursementId =
      type === "reimbursement_income"
        ? parseRequiredString(formData.get("reimbursementId"))
        : null;
    const weeklyBudgetImpactScope = normalizeWeeklyBudgetImpactScope(
      type,
      parseWeeklyBudgetImpactScope(formData.get("weeklyBudgetImpactScope"))
    );

    await createTransactionFromDraft({
      type,
      amount,
      accountId,
      destinationAccountId,
      categoryId,
      savingsBucketId,
      description,
      date,
      personName,
      reimbursementId,
      weeklyBudgetImpactScope
    });

    revalidateTransactionViews();

    return {
      status: "success",
      message: "Movimiento guardado."
    };
  } catch (error) {
    return {
      status: "error",
      message: getActionErrorMessage(error)
    };
  }
}

export const updateRecentTransaction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    const type = parseEditableTransactionType(formData.get("type"));
    const amount = parseAmount(formData.get("amount"));
    const date = parseDateOrNow(formData.get("date"));
    const accountId = parseRequiredString(formData.get("accountId"));
    const destinationAccountId =
      type === "transfer"
        ? parseRequiredString(formData.get("destinationAccountId"))
        : null;
    const categoryId =
      type === "expense" || type === "income"
        ? parseOptionalString(formData.get("categoryId"))
        : null;
    const savingsBucketId =
      type === "savings_allocation"
        ? parseRequiredString(formData.get("savingsBucketId"))
        : null;
    const description = parseOptionalString(formData.get("description"));
    const weeklyBudgetImpactScope = normalizeWeeklyBudgetImpactScope(
      type,
      parseWeeklyBudgetImpactScope(formData.get("weeklyBudgetImpactScope"))
    );

    await prisma.$transaction(async (tx) => {
      const transaction = await getEditableTransaction(tx, id, {
        allowConfirmedRecurring: true
      });

      await assertPeriodOpen(tx, date);
      if (transaction.recurringOccurrence && type !== transaction.type) {
        throw new Error(
          "No se puede cambiar el tipo de un movimiento fijo confirmado."
        );
      }
      const effectiveWeeklyBudgetImpactScope = transaction.recurringOccurrence
        ? "normal"
        : weeklyBudgetImpactScope;

      await reverseEditableTransaction(tx, transaction);

      const rules = getQuickTransactionRules({
        type,
        amount,
        accountId,
        destinationAccountId,
        savingsBucketId
      });

      await assertAccountExists(tx, accountId);
      if (destinationAccountId) {
        await assertAccountExists(tx, destinationAccountId);
      }
      if (categoryId && (type === "expense" || type === "income")) {
        await assertCategoryMatchesType(tx, categoryId, type);
      }
      if (savingsBucketId) {
        await assertSavingsBucketExists(tx, savingsBucketId);
      }

      await tx.transaction.update({
        where: { id },
        data: {
          accountId,
          affectsMonthlySavings: rules.impact.affectsMonthlySavings,
          affectsNetWorth: rules.impact.affectsNetWorth,
          affectsPersonalExpense: rules.impact.affectsPersonalExpense,
          affectsPersonalIncome: rules.impact.affectsPersonalIncome,
          affectsRealBalance: rules.impact.affectsRealBalance,
          amount,
          categoryId,
          date,
          description,
          destinationAccountId,
          weeklyBudgetImpactScope: effectiveWeeklyBudgetImpactScope,
          savingsBucketId,
          type
        }
      });

      await applyBalanceDeltas(tx, rules.balanceDeltas);

      if (rules.savingsBucketDelta > 0 && savingsBucketId) {
        await adjustBucketBalance(
          tx,
          savingsBucketId,
          rules.savingsBucketDelta
        );
      }

      if (transaction.recurringOccurrence) {
        await tx.recurringTransactionOccurrence.update({
          where: { id: transaction.recurringOccurrence.id },
          data: {
            amount
          }
        });
      }
    });

    revalidateTransactionViews();
  }
);

export const deleteRecentTransaction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));

    await prisma.$transaction(async (tx) => {
      const transaction = await getEditableTransaction(tx, id, {
        allowConfirmedRecurring: true
      });

      await reverseEditableTransaction(tx, transaction);

      if (transaction.recurringOccurrence) {
        await tx.recurringTransactionOccurrence.update({
          where: { id: transaction.recurringOccurrence.id },
          data: {
            generatedTransactionId: null,
            status: "skipped"
          }
        });
      }

      await tx.transaction.delete({ where: { id } });
    });

    revalidateTransactionViews();
  }
);

export const createReimbursableExpense = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    await createTransactionFromDraft({
      type: "reimbursable_expense",
      amount: parseAmount(formData.get("amount")),
      accountId: parseRequiredString(formData.get("accountId")),
      destinationAccountId: null,
      categoryId: parseOptionalString(formData.get("categoryId")),
      savingsBucketId: null,
      description: parseRequiredString(formData.get("title")),
      personName: parseRequiredString(formData.get("personName")),
      notes: parseOptionalString(formData.get("notes")),
      dueDate: parseOptionalDate(formData.get("dueDate")),
      date: parseDateOrNow(formData.get("date")),
      weeklyBudgetImpactScope: "normal"
    });

    revalidateReimbursementViews();
  }
);

export const recordReimbursementPayment = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    await createTransactionFromDraft({
      type: "reimbursement_income",
      amount: parseAmount(formData.get("amount")),
      accountId: parseRequiredString(formData.get("accountId")),
      destinationAccountId: null,
      categoryId: null,
      savingsBucketId: null,
      description: null,
      reimbursementId: parseRequiredString(formData.get("reimbursementId")),
      date: parseDateOrNow(formData.get("date")),
      weeklyBudgetImpactScope: "normal"
    });

    revalidateReimbursementViews();
  }
);

export const convertReimbursementToRealExpense = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const reimbursementId = parseRequiredString(
      formData.get("reimbursementId")
    );

    await prisma.$transaction(async (tx) => {
      await assertPeriodOpen(tx, new Date());
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

      const pendingAmount = normalizeMoney(
        toMoneyNumber(reimbursement.expectedAmount) -
          toMoneyNumber(reimbursement.paidAmount)
      );

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
          reimbursementId,
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
);

export const createAccount = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
  const name = parseRequiredString(formData.get("name"));
  const type = parseEnum(
    formData.get("type"),
    ACCOUNT_TYPES,
    "Tipo de cuenta no válido."
  );
  const currentBalance = parseAmountAllowingZero(
    formData.get("currentBalance")
  );
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

    const account = await tx.account.create({
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
    if (currentBalance !== 0) {
      await assertPeriodOpen(tx, new Date());
      await tx.transaction.create({
        data: {
          date: new Date(),
          accountId: account.id,
          type: "balance_adjustment",
          amount: Math.abs(currentBalance),
          balanceDelta: currentBalance,
          description: "Saldo inicial de la cuenta",
          affectsRealBalance: true,
          affectsPersonalExpense: false,
          affectsPersonalIncome: false,
          affectsMonthlySavings: false,
          affectsNetWorth: true
        }
      });
    }
  });

  revalidateAccountViews();
});

export const updateAccount = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
  const id = parseRequiredString(formData.get("id"));
  const name = parseRequiredString(formData.get("name"));
  const type = parseEnum(
    formData.get("type"),
    ACCOUNT_TYPES,
    "Tipo de cuenta no válido."
  );
  const currentBalance = parseAmountAllowingZero(
    formData.get("currentBalance")
  );
  const originalBalance = parseAmountAllowingZero(
    formData.get("originalBalance")
  );
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
    const account = await tx.account.findUniqueOrThrow({ where: { id } });
    const balanceChanged = currentBalance !== originalBalance;
    if (balanceChanged) {
      if (originalBalance !== toMoneyNumber(account.currentBalance))
        throw new Error(
          "El saldo ha cambiado desde que abriste el formulario. Recarga antes de corregirlo."
        );
      await assertPeriodOpen(tx, new Date());
      const delta = normalizeMoney(currentBalance - originalBalance);
      await tx.transaction.create({
        data: {
          date: new Date(),
          type: "balance_adjustment",
          amount: Math.abs(delta),
          balanceDelta: delta,
          accountId: id,
          description: "Corrección manual de saldo",
          affectsRealBalance: true,
          affectsPersonalExpense: false,
          affectsPersonalIncome: false,
          affectsMonthlySavings: false,
          affectsNetWorth: true
        }
      });
    }
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
        ...(balanceChanged ? { currentBalance } : {}),
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
});

export const deleteAccount = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
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
    const relatedRecurringTransactions = await tx.recurringTransaction.count({
      where: {
        OR: [{ accountId: id }, { destinationAccountId: id }]
      }
    });

    if (
      relatedTransactions > 0 ||
      relatedSnapshots > 0 ||
      relatedRecurringTransactions > 0
    ) {
      throw new Error(
        "No se puede eliminar una cuenta con movimientos o plantillas recurrentes."
      );
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
});

export const createSavingsBucket = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const name = parseRequiredString(formData.get("name"));
    const currentAmount = parseNonNegativeAmount(formData.get("currentAmount"));
    const targetAmount = parseOptionalNonNegativeAmount(
      formData.get("targetAmount")
    );
    const targetDate = parseOptionalDate(formData.get("targetDate"));
    const priority = parseOptionalInteger(
      formData.get("priority"),
      "La prioridad debe ser un número entero."
    );
    const notes = parseOptionalString(formData.get("notes"));

    await prisma.$transaction(async (tx) => {
      const bucket = await tx.savingsBucket.create({
        data: {
          name,
          currentAmount,
          targetAmount,
          targetDate,
          priority,
          isLongTerm: false,
          notes
        }
      });
      if (currentAmount > 0) {
        await assertPeriodOpen(tx, new Date());
        const account = await tx.account.findFirst({
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: { id: true }
        });
        if (!account)
          throw new Error(
            "Crea una cuenta antes de registrar el saldo inicial de una partida."
          );
        await tx.transaction.create({
          data: {
            date: new Date(),
            accountId: account.id,
            savingsBucketId: bucket.id,
            type: "savings_allocation",
            amount: currentAmount,
            description: "Ahorro previo asignado al crear la partida",
            ...getDefaultTransactionImpact("savings_allocation")
          }
        });
      }
    });

    revalidateSavingsViews();
  }
);

export const updateSavingsBucket = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    const name = parseRequiredString(formData.get("name"));
    const targetAmount = parseOptionalNonNegativeAmount(
      formData.get("targetAmount")
    );
    const targetDate = parseOptionalDate(formData.get("targetDate"));
    const priority = parseOptionalInteger(
      formData.get("priority"),
      "La prioridad debe ser un número entero."
    );
    const notes = parseOptionalString(formData.get("notes"));

    await prisma.savingsBucket.update({
      where: { id },
      data: {
        name,
        targetAmount,
        targetDate,
        priority,
        notes
      }
    });

    revalidateSavingsViews();
  }
);

export const deleteSavingsBucket = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));

    await prisma.$transaction(async (tx) => {
      const bucket = await tx.savingsBucket.findUnique({
        where: { id },
        select: { isLongTerm: true }
      });

      if (!bucket) {
        throw new Error("La partida de ahorro no existe.");
      }

      if (bucket.isLongTerm) {
        throw new Error(
          "La partida Largo plazo es derivada y no se puede eliminar."
        );
      }

      const relatedTransactions = await tx.transaction.count({
        where: { savingsBucketId: id }
      });
      const relatedSnapshots = await tx.monthlyBucketSnapshot.count({
        where: { savingsBucketId: id }
      });
      const relatedRecurringTransactions = await tx.recurringTransaction.count({
        where: { savingsBucketId: id }
      });

      if (
        relatedTransactions > 0 ||
        relatedSnapshots > 0 ||
        relatedRecurringTransactions > 0
      ) {
        throw new Error(
          "No se puede eliminar una partida con movimientos o plantillas recurrentes."
        );
      }

      await tx.savingsBucket.delete({ where: { id } });
    });

    revalidateSavingsViews();
  }
);

export const transferBetweenSavingsBuckets = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const sourceBucketId = parseRequiredString(formData.get("sourceBucketId"));
    const destinationBucketId = parseRequiredString(
      formData.get("destinationBucketId")
    );
    const amount = parseAmount(formData.get("amount"));
    const description = parseOptionalString(formData.get("description"));

    if (sourceBucketId === destinationBucketId) {
      throw new Error("Elige dos partidas distintas para transferir.");
    }

    await prisma.$transaction(async (tx) => {
      await assertPeriodOpen(tx, new Date());
      const [sourceBucket, destinationBucket, defaultAccount] =
        await Promise.all([
          tx.savingsBucket.findUnique({
            where: { id: sourceBucketId },
            select: {
              currentAmount: true,
              id: true,
              isLongTerm: true,
              name: true
            }
          }),
          tx.savingsBucket.findUnique({
            where: { id: destinationBucketId },
            select: {
              id: true,
              isLongTerm: true,
              name: true
            }
          }),
          tx.account.findFirst({
            orderBy: [{ isDefault: "desc" }, { name: "asc" }],
            select: { id: true }
          })
        ]);

      if (!sourceBucket || !destinationBucket) {
        throw new Error("La partida de ahorro seleccionada no existe.");
      }

      if (sourceBucket.isLongTerm || destinationBucket.isLongTerm) {
        throw new Error(
          "La partida de largo plazo se calcula desde cuentas y no admite transferencias manuales."
        );
      }

      if (!defaultAccount) {
        throw new Error(
          "No hay cuenta disponible para registrar la transferencia."
        );
      }

      if (amount > toMoneyNumber(sourceBucket.currentAmount)) {
        throw new Error("No hay suficiente saldo en la partida de origen.");
      }

      const savingsTransferId = randomUUID();
      const date = new Date();
      const withdrawalImpact =
        getDefaultTransactionImpact("savings_withdrawal");
      const allocationImpact =
        getDefaultTransactionImpact("savings_allocation");
      const transferDescription =
        description ??
        `Transferencia entre partidas: ${sourceBucket.name} -> ${destinationBucket.name}`;

      await adjustBucketBalance(tx, sourceBucket.id, -amount);

      await adjustBucketBalance(tx, destinationBucket.id, amount);

      await tx.transaction.create({
        data: {
          date,
          savingsTransferId,
          amount,
          type: "savings_withdrawal",
          description: transferDescription,
          accountId: defaultAccount.id,
          savingsBucketId: sourceBucket.id,
          affectsRealBalance: withdrawalImpact.affectsRealBalance,
          affectsPersonalExpense: withdrawalImpact.affectsPersonalExpense,
          affectsPersonalIncome: withdrawalImpact.affectsPersonalIncome,
          affectsMonthlySavings: withdrawalImpact.affectsMonthlySavings,
          affectsNetWorth: withdrawalImpact.affectsNetWorth
        }
      });

      await tx.transaction.create({
        data: {
          date,
          savingsTransferId,
          amount,
          type: "savings_allocation",
          description: transferDescription,
          accountId: defaultAccount.id,
          savingsBucketId: destinationBucket.id,
          affectsRealBalance: allocationImpact.affectsRealBalance,
          affectsPersonalExpense: allocationImpact.affectsPersonalExpense,
          affectsPersonalIncome: allocationImpact.affectsPersonalIncome,
          affectsMonthlySavings: allocationImpact.affectsMonthlySavings,
          affectsNetWorth: allocationImpact.affectsNetWorth
        }
      });
    });

    revalidateSavingsViews();
  }
);

export const undoSavingsTransfer = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("savingsTransferId"));
    await prisma.$transaction((tx) => undoSavingsTransferInTransaction(tx, id));
    revalidateSavingsViews();
  }
);

export async function closeMonth(
  _previousState: MonthlyCloseFormState,
  formData: FormData
): Promise<MonthlyCloseFormState> {
  await requireCurrentUser();
  try {
    const year = parseCloseYear(formData.get("year"));
    const month = parseCloseMonth(formData.get("month"));
    const notes = parseOptionalString(formData.get("notes"));
    const monthRange = getMonthDateRange(year, month);
    const closeDate = new Date(year, month, 0, 12);

    await prisma.$transaction(async (tx) => {
      await assertPeriodOpen(tx, monthRange.start);
      if (monthRange.start > new Date())
        throw new Error("No se puede cerrar un mes futuro.");
      const changesAfter = await getChangesAfter(tx, monthRange.end);
      const existingClose = await tx.monthlyClose.findUnique({
        where: {
          year_month: {
            year,
            month
          }
        },
        select: { id: true }
      });

      if (existingClose) {
        throw new Error("Ya existe un cierre guardado para ese mes.");
      }

      const [accounts, savingsBuckets] = await Promise.all([
        tx.account.findMany({
          orderBy: [{ isDefault: "desc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            currentBalance: true,
            includeInAvailableMoney: true,
            includeInNetWorth: true,
            includeInMonthlySavings: true,
            type: true
          }
        }),
        tx.savingsBucket.findMany({
          orderBy: [{ priority: "asc" }, { name: "asc" }],
          select: {
            id: true,
            currentAmount: true,
            isLongTerm: true
          }
        })
      ]);

      if (accounts.length === 0) {
        throw new Error("No hay cuentas para cerrar el mes.");
      }

      const defaultAccount = await tx.account.findFirst({
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true }
      });

      if (!defaultAccount) {
        throw new Error("No hay cuenta disponible para registrar el reparto.");
      }

      const manualSavingsBuckets = savingsBuckets.filter(
        (bucket) => !bucket.isLongTerm
      );
      const accountSnapshots: Array<{
        accountId: string;
        adjustmentTransactionId?: string;
        calculatedBalance: number;
        difference: number;
        realBalance: number;
      }> = [];
      const generatedCloseTransactionIds: string[] = [];
      const closedAccounts = accounts.map((account) => {
        const calculatedBalance = normalizeMoney(
          toMoneyNumber(account.currentBalance) -
            (changesAfter.accounts.get(account.id) ?? 0)
        );
        const realBalance = parseAmountAllowingZero(
          formData.get(`realBalance_${account.id}`)
        );
        const displayedBalance = formData.get(
          `calculatedBalance_${account.id}`
        );
        if (
          displayedBalance !== null &&
          parseAmountAllowingZero(displayedBalance) !== calculatedBalance
        )
          throw new Error(
            "Han cambiado los movimientos del mes. Recarga el cierre antes de confirmar los saldos."
          );
        const difference = normalizeMoney(realBalance - calculatedBalance);
        const adjustmentKind = parseEnum(
          formData.get(`adjustmentKind_${account.id}`),
          MONTHLY_CLOSE_ADJUSTMENT_KINDS,
          "Tipo de ajuste de cierre no válido."
        );

        accountSnapshots.push({
          accountId: account.id,
          calculatedBalance,
          difference,
          realBalance
        });

        return {
          ...account,
          currentBalance: realBalance,
          difference,
          realBalance,
          adjustmentKind
        };
      });

      for (const account of closedAccounts) {
        if (account.difference === 0) {
          continue;
        }

        validateAdjustmentDirection(account.adjustmentKind, account.difference);

        const impact = !account.includeInMonthlySavings
          ? getMonthlyCloseAdjustmentImpact("technical")
          : getMonthlyCloseAdjustmentImpact(account.adjustmentKind);
        // El importe se guarda en positivo; el signo real permanece en el
        // snapshot y los flags determinan su impacto en informes y ahorro.
        const adjustmentTransaction = await tx.transaction.create({
          data: {
            date: closeDate,
            amount: Math.abs(account.difference),
            balanceDelta: account.difference,
            type: "balance_adjustment",
            description: `Ajuste cierre ${String(month).padStart(2, "0")}/${year}: ${getAdjustmentKindLabel(
              account.adjustmentKind
            )}`,
            accountId: account.id,
            affectsRealBalance: true,
            affectsPersonalExpense: impact.affectsPersonalExpense,
            affectsPersonalIncome: impact.affectsPersonalIncome,
            affectsMonthlySavings: impact.affectsMonthlySavings,
            affectsNetWorth: impact.affectsNetWorth
          }
        });

        await adjustAccountBalance(tx, account.id, account.difference);

        const snapshot = accountSnapshots.find(
          (item) => item.accountId === account.id
        );

        if (snapshot) {
          snapshot.adjustmentTransactionId = adjustmentTransaction.id;
        }
        generatedCloseTransactionIds.push(adjustmentTransaction.id);
      }

      const transactionsAfterAdjustments = await tx.transaction.findMany({
        where: {
          date: {
            gte: monthRange.start,
            lt: monthRange.end
          }
        },
        select: {
          account: {
            select: {
              includeInMonthlySavings: true,
              includeInNetWorth: true,
              type: true
            }
          },
          date: true,
          destinationAccount: {
            select: {
              includeInMonthlySavings: true,
              includeInNetWorth: true,
              type: true
            }
          },
          amount: true,
          type: true,
          affectsPersonalExpense: true,
          affectsPersonalIncome: true,
          affectsMonthlySavings: true,
          affectsNetWorth: true
        }
      });

      const totalIncome = calculateRealMonthlyIncome(
        transactionsAfterAdjustments,
        year,
        month
      );
      const totalExpense = calculateRealMonthlyExpense(
        transactionsAfterAdjustments,
        year,
        month
      );
      const monthlySavings = calculateRealMonthlySavings(
        transactionsAfterAdjustments,
        year,
        month
      );
      const longTermTransferAllocation = calculateLongTermTransferAllocation(
        transactionsAfterAdjustments
      );
      const manualCloseResult = getManualMonthlyCloseResult(
        monthlySavings,
        longTermTransferAllocation
      );
      const savingsAllocations = manualSavingsBuckets.map((bucket) => ({
        bucketId: bucket.id,
        amount: parseAmountAllowingZero(
          formData.get(`savingsAllocation_${bucket.id}`)
        )
      }));
      const savingsReductions = manualSavingsBuckets.map((bucket) => ({
        bucketId: bucket.id,
        amount: parseAmountAllowingZero(
          formData.get(`savingsReduction_${bucket.id}`)
        )
      }));

      validatePositiveBucketAllocations(
        savingsAllocations,
        manualCloseResult.monthlySavings
      );
      const deficitFunding = getDeficitFunding(
        manualCloseResult.deficit,
        calculateAvailableMoney(closedAccounts),
        manualSavingsBuckets.reduce(
          (sum, bucket) =>
            sum +
            toMoneyNumber(bucket.currentAmount) -
            (changesAfter.buckets.get(bucket.id) ?? 0),
          0
        )
      );
      validateNegativeBucketReductions(
        savingsReductions,
        -deficitFunding.fromBuckets,
        manualSavingsBuckets.map((bucket) => ({
          currentAmount: Math.min(
            toMoneyNumber(bucket.currentAmount),
            normalizeMoney(
              toMoneyNumber(bucket.currentAmount) -
                (changesAfter.buckets.get(bucket.id) ?? 0)
            )
          ),
          id: bucket.id
        }))
      );

      for (const allocation of savingsAllocations) {
        if (allocation.amount <= 0) {
          continue;
        }

        const impact = getDefaultTransactionImpact("savings_allocation");

        // Repartir ahorro solo lo etiqueta mentalmente en una partida:
        // no mueve dinero bancario ni altera de nuevo el ahorro del mes.
        await adjustBucketBalance(tx, allocation.bucketId, allocation.amount);

        const transaction = await tx.transaction.create({
          data: {
            date: closeDate,
            amount: allocation.amount,
            type: "savings_allocation",
            description: `Reparto cierre ${String(month).padStart(2, "0")}/${year}`,
            accountId: defaultAccount.id,
            savingsBucketId: allocation.bucketId,
            affectsRealBalance: impact.affectsRealBalance,
            affectsPersonalExpense: impact.affectsPersonalExpense,
            affectsPersonalIncome: impact.affectsPersonalIncome,
            affectsMonthlySavings: impact.affectsMonthlySavings,
            affectsNetWorth: impact.affectsNetWorth
          }
        });
        generatedCloseTransactionIds.push(transaction.id);
      }

      for (const reduction of savingsReductions) {
        if (reduction.amount <= 0) {
          continue;
        }

        const impact = getDefaultTransactionImpact("savings_withdrawal");

        // Cubrir un déficit reduce ahorro ya asignado: no crea gasto ni
        // ingreso adicional y no mueve saldos bancarios reales.
        await adjustBucketBalance(tx, reduction.bucketId, -reduction.amount);

        const transaction = await tx.transaction.create({
          data: {
            date: closeDate,
            amount: reduction.amount,
            type: "savings_withdrawal",
            description: `Reducción cierre negativo ${String(month).padStart(
              2,
              "0"
            )}/${year}`,
            accountId: defaultAccount.id,
            savingsBucketId: reduction.bucketId,
            affectsRealBalance: impact.affectsRealBalance,
            affectsPersonalExpense: impact.affectsPersonalExpense,
            affectsPersonalIncome: impact.affectsPersonalIncome,
            affectsMonthlySavings: impact.affectsMonthlySavings,
            affectsNetWorth: impact.affectsNetWorth
          }
        });
        generatedCloseTransactionIds.push(transaction.id);
      }

      const [finalSavingsBuckets, reimbursements] = await Promise.all([
        tx.savingsBucket.findMany({
          orderBy: [{ priority: "asc" }, { name: "asc" }],
          select: {
            id: true,
            currentAmount: true,
            isLongTerm: true
          }
        }),
        getReimbursementsAt(tx, monthRange.end)
      ]);
      const finalAccounts = closedAccounts.map((account) => ({
        currentBalance: account.realBalance,
        includeInAvailableMoney: account.includeInAvailableMoney,
        includeInMonthlySavings: account.includeInMonthlySavings,
        includeInNetWorth: account.includeInNetWorth,
        type: account.type
      }));
      const availableMoney = calculateAvailableMoney(finalAccounts);
      const netWorth = calculateNetWorth(finalAccounts, reimbursements);
      const longTermAssets = calculateLongTermBucketBalance(finalAccounts);

      const monthlyClose = await tx.monthlyClose.create({
        data: {
          year,
          month,
          totalIncome,
          totalExpense,
          monthlySavings,
          availableMoney,
          netWorth,
          longTermAssets,
          deficitFromFreeSavings: deficitFunding.fromFreeSavings,
          notes,
          closedAt: new Date()
        }
      });

      if (generatedCloseTransactionIds.length > 0) {
        await tx.transaction.updateMany({
          where: {
            id: {
              in: generatedCloseTransactionIds
            }
          },
          data: {
            monthlyCloseId: monthlyClose.id
          }
        });
      }

      for (const snapshot of accountSnapshots) {
        await tx.monthlyAccountSnapshot.create({
          data: {
            monthlyCloseId: monthlyClose.id,
            accountId: snapshot.accountId,
            calculatedBalance: snapshot.calculatedBalance,
            realBalance: snapshot.realBalance,
            difference: snapshot.difference,
            adjustmentTransactionId: snapshot.adjustmentTransactionId
          }
        });
      }

      const bucketSnapshots = createMonthlyBucketSnapshots(
        finalSavingsBuckets.map((bucket) => ({
          amount: bucket.isLongTerm
            ? longTermAssets
            : normalizeMoney(
                toMoneyNumber(bucket.currentAmount) -
                  (changesAfter.buckets.get(bucket.id) ?? 0)
              ),
          id: bucket.id
        }))
      );

      for (const bucketSnapshot of bucketSnapshots) {
        await tx.monthlyBucketSnapshot.create({
          data: {
            monthlyCloseId: monthlyClose.id,
            savingsBucketId: bucketSnapshot.savingsBucketId,
            amount: bucketSnapshot.amount
          }
        });
      }
    });

    revalidateMonthlyCloseViews();

    return {
      status: "success",
      message: "Cierre mensual guardado."
    };
  } catch (error) {
    return {
      status: "error",
      message: getActionErrorMessage(error)
    };
  }
}

export const undoLatestMonthlyClose = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const closeId = parseRequiredString(formData.get("closeId"));
    const returnTo = parseUndoReturnTo(formData.get("returnTo"));

    await prisma.$transaction(async (tx) => {
      const close = await tx.monthlyClose.findUnique({
        where: { id: closeId },
        include: {
          accountSnapshots: {
            select: {
              adjustmentTransactionId: true,
              accountId: true,
              difference: true
            }
          },
          generatedTransactions: {
            select: {
              amount: true,
              id: true,
              savingsBucketId: true,
              type: true
            }
          }
        }
      });

      if (!close) {
        throw new Error("El cierre mensual no existe.");
      }

      const latestClose = await tx.monthlyClose.findFirst({
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { id: true }
      });

      if (!latestClose || latestClose.id !== close.id) {
        throw new Error("Solo se puede deshacer el último cierre mensual.");
      }

      const bucketDeltas = new Map<string, number>();
      for (const transaction of close.generatedTransactions) {
        if (!transaction.savingsBucketId) continue;
        const delta =
          transaction.type === "savings_allocation"
            ? -toMoneyNumber(transaction.amount)
            : transaction.type === "savings_withdrawal"
              ? toMoneyNumber(transaction.amount)
              : 0;
        bucketDeltas.set(
          transaction.savingsBucketId,
          normalizeMoney(
            (bucketDeltas.get(transaction.savingsBucketId) ?? 0) + delta
          )
        );
      }
      for (const [id, delta] of bucketDeltas) {
        const bucket = await tx.savingsBucket.findUniqueOrThrow({
          where: { id }
        });
        if (normalizeMoney(toMoneyNumber(bucket.currentAmount) + delta) < 0)
          throw new Error(
            `Devuelve primero el dinero utilizado de la partida ${bucket.name} para reabrir este cierre.`
          );
      }

      for (const snapshot of close.accountSnapshots) {
        const difference = toMoneyNumber(snapshot.difference);

        if (difference === 0) {
          continue;
        }

        await adjustAccountBalance(tx, snapshot.accountId, -difference);
      }

      for (const transaction of close.generatedTransactions) {
        if (!transaction.savingsBucketId) {
          continue;
        }

        const amount = toMoneyNumber(transaction.amount);

        if (transaction.type === "savings_allocation") {
          await adjustBucketBalance(tx, transaction.savingsBucketId, -amount);
        }

        if (transaction.type === "savings_withdrawal") {
          await adjustBucketBalance(tx, transaction.savingsBucketId, amount);
        }
      }

      const generatedTransactionIds = new Set(
        close.generatedTransactions.map((transaction) => transaction.id)
      );

      for (const snapshot of close.accountSnapshots) {
        if (snapshot.adjustmentTransactionId) {
          generatedTransactionIds.add(snapshot.adjustmentTransactionId);
        }
      }

      if (generatedTransactionIds.size > 0) {
        await tx.transaction.deleteMany({
          where: {
            id: {
              in: Array.from(generatedTransactionIds)
            }
          }
        });
      }

      await tx.monthlyClose.delete({
        where: { id: close.id }
      });
    });

    revalidateMonthlyCloseViews();
    redirect(returnTo);
  }
);

type EditableTransaction = Prisma.TransactionGetPayload<{
  include: {
    originalReimbursement: { select: { id: true } };
    recurringOccurrence: { select: { id: true } };
  };
}>;

async function getEditableTransaction(
  tx: Prisma.TransactionClient,
  id: string,
  options: { allowConfirmedRecurring?: boolean } = {}
): Promise<EditableTransaction> {
  const transaction = await tx.transaction.findUnique({
    where: { id },
    include: {
      originalReimbursement: { select: { id: true } },
      recurringOccurrence: { select: { id: true } }
    }
  });

  if (!transaction) {
    throw new Error("El movimiento no existe.");
  }

  await assertPeriodOpen(tx, transaction.date);

  if (transaction.savingsTransferId)
    throw new Error(
      "Esta transferencia se gestiona como una operación completa desde partidas."
    );
  if (transaction.type === "expense" && !transaction.affectsRealBalance)
    throw new Error("Gestiona este gasto convertido desde reembolsos.");

  if (transaction.monthlyCloseId) {
    throw new Error("No se puede editar un movimiento incluido en un cierre.");
  }

  if (transaction.originalReimbursement || transaction.reimbursementId) {
    throw new Error("Gestiona los reembolsos desde su pantalla específica.");
  }

  if (transaction.recurringOccurrence && !options.allowConfirmedRecurring) {
    throw new Error(
      "Gestiona los movimientos fijos desde su pantalla específica."
    );
  }

  if (
    !EDITABLE_TRANSACTION_TYPES.has(transaction.type as QuickTransactionType)
  ) {
    throw new Error(
      "Este tipo de movimiento no se puede editar desde recientes."
    );
  }

  return transaction;
}

async function reverseEditableTransaction(
  tx: Prisma.TransactionClient,
  transaction: EditableTransaction
): Promise<void> {
  const amount = toMoneyNumber(transaction.amount);

  if (transaction.type === "expense" && transaction.affectsRealBalance) {
    await adjustAccountBalance(tx, transaction.accountId, amount);
    return;
  }

  if (transaction.type === "income" && transaction.affectsRealBalance) {
    await adjustAccountBalance(tx, transaction.accountId, -amount);
    return;
  }

  if (transaction.type === "transfer" && transaction.affectsRealBalance) {
    await adjustAccountBalance(tx, transaction.accountId, amount);

    if (transaction.destinationAccountId) {
      await adjustAccountBalance(tx, transaction.destinationAccountId, -amount);
    }
    return;
  }

  if (
    transaction.type === "savings_allocation" &&
    transaction.savingsBucketId
  ) {
    const bucket = await tx.savingsBucket.findUnique({
      where: { id: transaction.savingsBucketId },
      select: { currentAmount: true }
    });

    if (!bucket || toMoneyNumber(bucket.currentAmount) < amount) {
      throw new Error("No hay saldo suficiente en la partida para revertirlo.");
    }

    await adjustBucketBalance(tx, transaction.savingsBucketId, -amount);
  }
}

function parseCloseMonth(value: FormDataEntryValue | null): number {
  const parsedValue = parseInteger(value, "Mes no válido.");

  if (parsedValue < 1 || parsedValue > 12) {
    throw new Error("Mes no válido.");
  }

  return parsedValue;
}

function parseCloseYear(value: FormDataEntryValue | null): number {
  const parsedValue = parseInteger(value, "Año no válido.");

  if (parsedValue < 2000 || parsedValue > 2100) {
    throw new Error("Año no válido.");
  }

  return parsedValue;
}

function parseUndoReturnTo(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") {
    return "/history";
  }

  if (
    value === "/history" ||
    value === "/monthly-close" ||
    value.startsWith("/monthly-close?")
  ) {
    return value;
  }

  return "/history";
}

function getMonthlyCloseAdjustmentImpact(
  kind: MonthlyCloseAdjustmentKind
): MonthlyCloseAdjustmentImpact {
  if (kind === "expense") {
    return {
      affectsPersonalExpense: true,
      affectsPersonalIncome: false,
      affectsMonthlySavings: true,
      affectsNetWorth: true
    };
  }

  if (kind === "income") {
    return {
      affectsPersonalExpense: false,
      affectsPersonalIncome: true,
      affectsMonthlySavings: true,
      affectsNetWorth: true
    };
  }

  if (kind === "unassigned_savings") {
    return {
      affectsPersonalExpense: false,
      affectsPersonalIncome: false,
      affectsMonthlySavings: false,
      affectsNetWorth: true
    };
  }

  return {
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false
  };
}

function getAdjustmentKindLabel(kind: MonthlyCloseAdjustmentKind): string {
  if (kind === "expense") {
    return "gasto real";
  }

  if (kind === "income") {
    return "ingreso real";
  }

  if (kind === "unassigned_savings") {
    return "ajuste de ahorro no asignado";
  }

  return "ajuste técnico";
}

function validateAdjustmentDirection(
  kind: MonthlyCloseAdjustmentKind,
  difference: number
): void {
  if (kind === "expense" && difference > 0) {
    throw new Error(
      "Un ajuste de gasto real debe reducir el saldo de la cuenta."
    );
  }

  if (kind === "income" && difference < 0) {
    throw new Error(
      "Un ajuste de ingreso real debe aumentar el saldo de la cuenta."
    );
  }
}

function parseEditableTransactionType(
  value: FormDataEntryValue | null
): QuickTransactionType {
  const type = parseEnum(
    value,
    QUICK_TRANSACTION_TYPES,
    "Tipo de movimiento no válido."
  );

  if (!EDITABLE_TRANSACTION_TYPES.has(type)) {
    throw new Error(
      "Este tipo de movimiento no se puede editar desde recientes."
    );
  }

  return type;
}

function parseWeeklyBudgetImpactScope(
  value: FormDataEntryValue | null
): WeeklyBudgetImpactScope {
  return parseOptionalString(value) === null
    ? "normal"
    : parseEnum(
        value,
        WEEKLY_BUDGET_IMPACT_SCOPES,
        "Impacto en objetivo semanal no válido."
      );
}

function normalizeWeeklyBudgetImpactScope(
  type: QuickTransactionType,
  scope: WeeklyBudgetImpactScope
): WeeklyBudgetImpactScope {
  if (type === "income") {
    return scope === "include_weekly_and_monthly_income" ? scope : "normal";
  }

  if (type === "expense") {
    return scope === "exclude_weekly_expense" ||
      scope === "exclude_weekly_and_monthly"
      ? scope
      : "normal";
  }

  if (type === "transfer") {
    return scope === "exclude_weekly_and_monthly" ? scope : "normal";
  }

  return "normal";
}

function revalidateReimbursementViews(): void {
  revalidatePath("/");
  revalidatePath("/reimbursements");
}

function revalidateTransactionViews(): void {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/reimbursements");
  revalidatePath("/savings");
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
  revalidatePath("/savings/[bucketId]", "page");
  revalidatePath("/monthly-close");
}

function revalidateMonthlyCloseViews(): void {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/history");
  revalidatePath("/monthly-close");
  revalidatePath("/savings");
}
