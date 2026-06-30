import { getScheduledDatesForMonth } from "@/domain/recurring-transactions";
import {
  getWeeklyBudgetStatus,
  type WeeklyBudgetCalculationMode
} from "@/domain/weekly-budget";
import { getMonthDateRange, toMoneyNumber } from "@/domain/financial-calculations";
import { prisma } from "./prisma";

export const DEFAULT_BUDGET_SETTING_ID = "default";

export async function getOrCreateBudgetSetting() {
  return prisma.budgetSetting.upsert({
    where: { id: DEFAULT_BUDGET_SETTING_ID },
    update: {},
    create: {
      id: DEFAULT_BUDGET_SETTING_ID,
      monthlyMinimumSavingsTarget: 300,
      calculationMode: "remaining_days",
      includeReimbursableExpenses: false,
      includePendingTransactions: false
    },
    include: {
      savingsBucket: {
        select: { id: true, name: true }
      }
    }
  });
}

export async function getWeeklyBudgetReport(referenceDate: Date = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth() + 1;
  const monthRange = getMonthDateRange(year, month);

  const [setting, recurringTransactions, transactions] = await Promise.all([
    getOrCreateBudgetSetting(),
    prisma.recurringTransaction.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { dayOfMonth: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true,
        amount: true,
        frequency: true,
        dayOfMonth: true,
        dayOfWeek: true,
        startDate: true,
        endDate: true,
        isActive: true,
        account: {
          select: { name: true }
        },
        category: {
          select: { name: true }
        }
      }
    }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: monthRange.start,
          lt: monthRange.end
        }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        amount: true,
        type: true,
        description: true,
        affectsPersonalExpense: true,
        affectsPersonalIncome: true,
        weeklyBudgetImpactScope: true,
        account: {
          select: {
            name: true,
            includeInAvailableMoney: true
          }
        },
        destinationAccount: {
          select: {
            name: true,
            includeInAvailableMoney: true
          }
        },
        category: {
          select: { name: true }
        },
        recurringOccurrence: {
          select: { id: true }
        }
      }
    })
  ]);

  const settingForCalculation = {
    monthlyMinimumSavingsTarget: setting.monthlyMinimumSavingsTarget,
    calculationMode: setting.calculationMode as WeeklyBudgetCalculationMode,
    includeReimbursableExpenses: setting.includeReimbursableExpenses,
    includePendingTransactions: setting.includePendingTransactions
  };
  const transactionsForCalculation = transactions.map((transaction) => ({
    ...transaction,
    recurringOccurrenceId: transaction.recurringOccurrence?.id ?? null,
    isPending: false,
    sourceAccountIncludeInAvailableMoney:
      transaction.account.includeInAvailableMoney,
    destinationAccountIncludeInAvailableMoney:
      transaction.destinationAccount?.includeInAvailableMoney ?? null
  }));
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions: transactionsForCalculation,
    setting: settingForCalculation,
    referenceDate
  });
  const activeThisMonth = recurringTransactions.filter(
    (transaction) =>
      getScheduledDatesForMonth(transaction, year, month).length > 0
  );
  const includedWeekIds = new Set(
    status.variableExpensesForWeek.map((transaction) => transaction.id)
  );
  const includedTransferIds = new Set(
    status.availabilityReducingTransfersForWeek.map(
      (transaction) => transaction.id
    )
  );
  const includedBudgetAdjustmentIds = new Set(
    status.budgetAdjustingExpensesForWeek.map((transaction) => transaction.id)
  );
  const includedExtraIncomeIds = new Set(
    status.extraIncomesForWeek.map((transaction) => transaction.id)
  );

  return {
    setting: {
      ...setting,
      monthlyMinimumSavingsTarget: toMoneyNumber(
        setting.monthlyMinimumSavingsTarget
      )
    },
    status,
    fixedIncomeItems: activeThisMonth
      .filter((transaction) => transaction.type === "income")
      .map((transaction) => toFixedItem(transaction, year, month)),
    fixedExpenseItems: activeThisMonth
      .filter((transaction) => transaction.type === "expense")
      .map((transaction) => toFixedItem(transaction, year, month)),
    variableExpensesForWeek: transactions
      .filter((transaction) => includedWeekIds.has(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: toMoneyNumber(transaction.amount),
        description:
          transaction.description ??
          transaction.category?.name ??
          "Gasto sin descripción",
        accountName: transaction.account.name,
        categoryName: transaction.category?.name ?? null,
        type: transaction.type
      })),
    availabilityReducingTransfersForWeek: transactions
      .filter((transaction) => includedTransferIds.has(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: toMoneyNumber(transaction.amount),
        description:
          transaction.description ?? "Transferencia a ahorro o inversión",
        accountName: transaction.account.name,
        destinationAccountName:
          transaction.destinationAccount?.name ?? "Cuenta no disponible"
      })),
    budgetAdjustingExpensesForWeek: transactions
      .filter((transaction) => includedBudgetAdjustmentIds.has(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: toMoneyNumber(transaction.amount),
        description:
          transaction.description ??
          transaction.category?.name ??
          "Gasto fuera del objetivo semanal",
        accountName: transaction.account.name,
        categoryName: transaction.category?.name ?? null,
        type: transaction.type
      })),
    extraIncomesForWeek: transactions
      .filter((transaction) => includedExtraIncomeIds.has(transaction.id))
      .map((transaction) => ({
        id: transaction.id,
        date: transaction.date,
        amount: toMoneyNumber(transaction.amount),
        description:
          transaction.description ??
          transaction.category?.name ??
          "Ingreso extra incluido",
        accountName: transaction.account.name,
        categoryName: transaction.category?.name ?? null,
        type: transaction.type
      }))
  };
}

function toFixedItem(
  transaction: {
    id: string;
    name: string;
    amount: Parameters<typeof toMoneyNumber>[0];
    frequency: "monthly" | "weekly";
    dayOfMonth: number;
    dayOfWeek: number;
    startDate: Date;
    endDate: Date | null;
    account: { name: string };
    category: { name: string } | null;
  },
  year: number,
  month: number
) {
  const occurrenceCount = getScheduledDatesForMonth(
    transaction,
    year,
    month
  ).length;
  const amountPerOccurrence = toMoneyNumber(transaction.amount);

  return {
    id: transaction.id,
    name: transaction.name,
    amount: amountPerOccurrence * occurrenceCount,
    amountPerOccurrence,
    frequency: transaction.frequency,
    dayOfMonth: transaction.dayOfMonth,
    dayOfWeek: transaction.dayOfWeek,
    occurrenceCount,
    accountName: transaction.account.name,
    categoryName: transaction.category?.name ?? null
  };
}
