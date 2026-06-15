"use server";

import { revalidatePath } from "next/cache";
import type { AccountType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  calculateAvailableMoney,
  calculateNetWorth,
  calculateRealMonthlyExpense,
  calculateRealMonthlyIncome,
  calculateRealMonthlySavings,
  getDefaultTransactionImpact,
  getMonthDateRange,
  toMoneyNumber
} from "@/domain/financial-calculations";
import {
  ACCOUNT_TYPES,
  QUICK_TRANSACTION_TYPES
} from "@/domain/domain-options";
import {
  getConvertReimbursementToExpenseRules,
  getReimbursementTransactionRules,
  type QuickTransactionType
} from "@/domain/transaction-rules";
import { normalizeMoney, parseMoneyInput } from "@/domain/money";
import { createTransactionFromDraft } from "@/lib/transactions";

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

const VALID_QUICK_TRANSACTION_TYPES = new Set<QuickTransactionType>(
  QUICK_TRANSACTION_TYPES
);
const VALID_MONTHLY_CLOSE_ADJUSTMENT_KINDS = new Set<MonthlyCloseAdjustmentKind>([
  "expense",
  "income",
  "technical",
  "unassigned_savings"
]);
const VALID_ACCOUNT_TYPES = new Set<AccountType>(ACCOUNT_TYPES);

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
      type === "expense" ||
      type === "income" ||
      type === "reimbursable_expense"
        ? parseOptionalString(formData.get("categoryId"))
        : null;
    const savingsBucketId =
      type === "savings_allocation"
        ? parseRequiredString(formData.get("savingsBucketId"))
        : null;
    const description = parseOptionalString(formData.get("description"));
    const date = parseTransactionDate(formData.get("date"));
    const personName =
      type === "reimbursable_expense"
        ? parseRequiredString(formData.get("personName"))
        : null;
    const reimbursementId =
      type === "reimbursement_income"
        ? parseRequiredString(formData.get("reimbursementId"))
        : null;

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
      reimbursementId
    });

    revalidateTransactionViews();

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

export async function closeMonth(
  _previousState: MonthlyCloseFormState,
  formData: FormData
): Promise<MonthlyCloseFormState> {
  try {
    const year = parseCloseYear(formData.get("year"));
    const month = parseCloseMonth(formData.get("month"));
    const notes = parseOptionalString(formData.get("notes"));
    const monthRange = getMonthDateRange(year, month);
    const closeDate = new Date(year, month, 0, 12);

    await prisma.$transaction(async (tx) => {
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

      const accountSnapshots: Array<{
        accountId: string;
        adjustmentTransactionId?: string;
        calculatedBalance: number;
        difference: number;
        realBalance: number;
      }> = [];
      const closedAccounts = accounts.map((account) => {
        const calculatedBalance = toMoneyNumber(account.currentBalance);
        const realBalance = parseAmountAllowingZero(
          formData.get(`realBalance_${account.id}`)
        );
        const difference = roundMoney(realBalance - calculatedBalance);
        const adjustmentKind = parseMonthlyCloseAdjustmentKind(
          formData.get(`adjustmentKind_${account.id}`)
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

        const impact = getMonthlyCloseAdjustmentImpact(account.adjustmentKind);
        // El importe se guarda en positivo; el signo real permanece en el
        // snapshot y los flags determinan su impacto en informes y ahorro.
        const adjustmentTransaction = await tx.transaction.create({
          data: {
            date: closeDate,
            amount: Math.abs(account.difference),
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

        await tx.account.update({
          where: { id: account.id },
          data: {
            currentBalance: {
              increment: account.difference
            }
          }
        });

        const snapshot = accountSnapshots.find(
          (item) => item.accountId === account.id
        );

        if (snapshot) {
          snapshot.adjustmentTransactionId = adjustmentTransaction.id;
        }
      }

      const transactionsAfterAdjustments = await tx.transaction.findMany({
        where: {
          date: {
            gte: monthRange.start,
            lt: monthRange.end
          }
        },
        select: {
          date: true,
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
      const savingsAllocations = savingsBuckets.map((bucket) => ({
        bucketId: bucket.id,
        amount: parseAmountAllowingZero(
          formData.get(`savingsAllocation_${bucket.id}`)
        )
      }));
      const negativeAllocation = savingsAllocations.find(
        (allocation) => allocation.amount < 0
      );

      if (negativeAllocation) {
        throw new Error("El reparto de ahorro no puede contener importes negativos.");
      }

      const totalAllocated = roundMoney(
        savingsAllocations.reduce(
          (total, allocation) => total + allocation.amount,
          0
        )
      );

      if (totalAllocated < 0) {
        throw new Error("El reparto de ahorro no puede ser negativo.");
      }

      if (monthlySavings <= 0 && totalAllocated > 0) {
        throw new Error("No se puede repartir ahorro si el ahorro mensual no es positivo.");
      }

      if (monthlySavings > 0 && totalAllocated > roundMoney(monthlySavings)) {
        throw new Error("El reparto no puede superar el ahorro mensual real.");
      }

      for (const allocation of savingsAllocations) {
        if (allocation.amount <= 0) {
          continue;
        }

        const impact = getDefaultTransactionImpact("savings_allocation");

        // Repartir ahorro solo lo etiqueta mentalmente en una partida:
        // no mueve dinero bancario ni altera de nuevo el ahorro del mes.
        await tx.savingsBucket.update({
          where: { id: allocation.bucketId },
          data: {
            currentAmount: {
              increment: allocation.amount
            }
          }
        });

        await tx.transaction.create({
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
      }

      const [finalSavingsBuckets, reimbursements] = await Promise.all([
        tx.savingsBucket.findMany({
          orderBy: [{ priority: "asc" }, { name: "asc" }],
          select: {
            id: true,
            currentAmount: true
          }
        }),
        tx.reimbursement.findMany({
          select: {
            id: true,
            title: true,
            personName: true,
            expectedAmount: true,
            paidAmount: true,
            status: true,
            dueDate: true
          }
        })
      ]);
      const finalAccounts = closedAccounts.map((account) => ({
        currentBalance: account.realBalance,
        includeInAvailableMoney: account.includeInAvailableMoney,
        includeInNetWorth: account.includeInNetWorth,
        type: account.type
      }));
      const availableMoney = calculateAvailableMoney(finalAccounts);
      const netWorth = calculateNetWorth(finalAccounts, reimbursements);
      const longTermAssets = finalAccounts
        .filter((account) =>
          ["investment", "pension", "treasury"].includes(account.type)
        )
        .reduce(
          (total, account) => total + toMoneyNumber(account.currentBalance),
          0
        );

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
          notes,
          closedAt: new Date()
        }
      });

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

      for (const bucket of finalSavingsBuckets) {
        await tx.monthlyBucketSnapshot.create({
          data: {
            monthlyCloseId: monthlyClose.id,
            savingsBucketId: bucket.id,
            amount: bucket.currentAmount
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
      message:
        error instanceof Error
          ? error.message
          : "No se pudo guardar el cierre mensual."
    };
  }
}

function parseCloseMonth(value: FormDataEntryValue | null): number {
  const parsedValue = parseIntegerField(value, "Mes no válido.");

  if (parsedValue < 1 || parsedValue > 12) {
    throw new Error("Mes no válido.");
  }

  return parsedValue;
}

function parseCloseYear(value: FormDataEntryValue | null): number {
  const parsedValue = parseIntegerField(value, "Año no válido.");

  if (parsedValue < 2000 || parsedValue > 2100) {
    throw new Error("Año no válido.");
  }

  return parsedValue;
}

function parseIntegerField(
  value: FormDataEntryValue | null,
  errorMessage: string
): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue)) {
    throw new Error(errorMessage);
  }

  return parsedValue;
}

function parseMonthlyCloseAdjustmentKind(
  value: FormDataEntryValue | null
): MonthlyCloseAdjustmentKind {
  if (
    typeof value !== "string" ||
    !VALID_MONTHLY_CLOSE_ADJUSTMENT_KINDS.has(
      value as MonthlyCloseAdjustmentKind
    )
  ) {
    throw new Error("Tipo de ajuste de cierre no válido.");
  }

  return value as MonthlyCloseAdjustmentKind;
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
    throw new Error("Un ajuste de gasto real debe reducir el saldo de la cuenta.");
  }

  if (kind === "income" && difference < 0) {
    throw new Error("Un ajuste de ingreso real debe aumentar el saldo de la cuenta.");
  }
}

function roundMoney(value: number): number {
  return normalizeMoney(value);
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

  const amount = parseMoneyInput(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }

  return amount;
}

function parseAmountAllowingZero(value: FormDataEntryValue | null): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    return 0;
  }

  const amount = parseMoneyInput(value);

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
  type: "expense" | "income"
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
}

function revalidateMonthlyCloseViews(): void {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/history");
  revalidatePath("/monthly-close");
  revalidatePath("/savings");
}
