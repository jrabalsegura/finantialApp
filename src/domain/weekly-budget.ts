import { getScheduledDatesForMonth } from "./recurring-transactions";
import {
  toMoneyNumber,
  type MoneyValue,
  type TransactionType
} from "./financial-calculations";
import { currencyFormatter } from "@/lib/formatters";

export type WeeklyBudgetCalculationMode =
  | "full_month_proportional"
  | "remaining_days";

export type BudgetSettingForCalculation = {
  monthlyMinimumSavingsTarget: MoneyValue;
  calculationMode: WeeklyBudgetCalculationMode;
  includeReimbursableExpenses: boolean;
  includePendingTransactions: boolean;
};

export type RecurringTransactionForBudget = {
  id: string;
  name: string;
  type: "expense" | "income" | "transfer" | "savings_allocation";
  amount: MoneyValue;
  dayOfMonth: number;
  dayOfWeek?: number;
  frequency?: "monthly" | "weekly";
  startDate: Date | string;
  endDate?: Date | string | null;
  isActive: boolean;
};

export type VariableExpenseForBudget = {
  id: string;
  date: Date | string;
  amount: MoneyValue;
  type: TransactionType;
  affectsPersonalExpense: boolean;
  excludeFromWeeklyBudget?: boolean;
  recurringOccurrenceId?: string | null;
  isPending?: boolean;
  sourceAccountIncludeInAvailableMoney?: boolean;
  destinationAccountIncludeInAvailableMoney?: boolean | null;
};

export type WeeklyBudgetStatus = {
  hasSufficientConfiguration: boolean;
  fixedMonthlyIncome: number;
  fixedMonthlyExpenses: number;
  monthlyMinimumSavingsTarget: number;
  monthlyVariableBudget: number;
  monthlyVariableExpense: number;
  monthlyTransferredOutOfAvailable: number;
  remainingVariableBudget: number;
  remainingDaysInMonth: number;
  weeklyAllocationRemainingDaysInMonth: number;
  dailyAvailableBudget: number;
  weekStart: Date;
  weekEnd: Date;
  daysInCurrentWeekWithinMonth: number;
  remainingDaysInCurrentWeekWithinMonth: number;
  currentWeekAvailableBudget: number;
  currentWeekVariableExpense: number;
  currentWeekTransferredOutOfAvailable: number;
  currentWeekDifference: number;
  percentageUsed: number | null;
  message: string;
  variableExpensesForWeek: VariableExpenseForBudget[];
  availabilityReducingTransfersForWeek: VariableExpenseForBudget[];
};

const EXCLUDED_VARIABLE_EXPENSE_TYPES = new Set<TransactionType>([
  "transfer",
  "reimbursement_income",
  "investment_gain",
  "investment_loss",
  "balance_adjustment",
  "savings_allocation",
  "savings_withdrawal"
]);

export function getFixedMonthlyIncome(
  recurringTransactions: RecurringTransactionForBudget[],
  referenceDate: Date = new Date()
): number {
  return sumRecurringTransactions(
    recurringTransactions,
    "income",
    referenceDate
  );
}

export function getFixedMonthlyExpenses(
  recurringTransactions: RecurringTransactionForBudget[],
  referenceDate: Date = new Date()
): number {
  return sumRecurringTransactions(
    recurringTransactions,
    "expense",
    referenceDate
  );
}

export function getMonthlyVariableBudget(
  fixedMonthlyIncome: number,
  fixedMonthlyExpenses: number,
  monthlyMinimumSavingsTarget: MoneyValue
): number {
  return roundMoney(
    fixedMonthlyIncome -
      fixedMonthlyExpenses -
      toMoneyNumber(monthlyMinimumSavingsTarget)
  );
}

export function getVariableExpensesForMonth(
  transactions: VariableExpenseForBudget[],
  referenceDate: Date,
  setting: Pick<
    BudgetSettingForCalculation,
    "includePendingTransactions" | "includeReimbursableExpenses"
  >
): VariableExpenseForBudget[] {
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const throughToday = endOfDay(referenceDate);

  return transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return (
      date >= monthStart &&
      date <= monthEnd &&
      date <= throughToday &&
      isVariableExpense(transaction, setting)
    );
  });
}

export function getVariableExpensesForWeek(
  transactions: VariableExpenseForBudget[],
  referenceDate: Date,
  setting: Pick<
    BudgetSettingForCalculation,
    "includePendingTransactions" | "includeReimbursableExpenses"
  >
): VariableExpenseForBudget[] {
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = endOfWeek(referenceDate);
  const monthStart = startOfMonth(referenceDate);
  const monthEnd = endOfMonth(referenceDate);
  const throughToday = endOfDay(referenceDate);
  const rangeStart = maxDate(weekStart, monthStart);
  const rangeEnd = minDate(weekEnd, monthEnd, throughToday);

  return transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return (
      date >= rangeStart &&
      date <= rangeEnd &&
      isVariableExpense(transaction, setting)
    );
  });
}

export function getAvailabilityReducingTransfersForMonth(
  transactions: VariableExpenseForBudget[],
  referenceDate: Date,
  setting: Pick<BudgetSettingForCalculation, "includePendingTransactions">
): VariableExpenseForBudget[] {
  return transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return (
      date >= startOfMonth(referenceDate) &&
      date <= endOfMonth(referenceDate) &&
      date <= endOfDay(referenceDate) &&
      isAvailabilityReducingTransfer(transaction, setting)
    );
  });
}

export function getAvailabilityReducingTransfersForWeek(
  transactions: VariableExpenseForBudget[],
  referenceDate: Date,
  setting: Pick<BudgetSettingForCalculation, "includePendingTransactions">
): VariableExpenseForBudget[] {
  const rangeStart = maxDate(
    startOfWeek(referenceDate),
    startOfMonth(referenceDate)
  );
  const rangeEnd = minDate(
    endOfWeek(referenceDate),
    endOfMonth(referenceDate),
    endOfDay(referenceDate)
  );

  return transactions.filter((transaction) => {
    const date = new Date(transaction.date);
    return (
      date >= rangeStart &&
      date <= rangeEnd &&
      isAvailabilityReducingTransfer(transaction, setting)
    );
  });
}

export function getWeeklyBudgetStatus({
  recurringTransactions,
  referenceDate = new Date(),
  setting,
  transactions
}: {
  recurringTransactions: RecurringTransactionForBudget[];
  referenceDate?: Date;
  setting: BudgetSettingForCalculation;
  transactions: VariableExpenseForBudget[];
}): WeeklyBudgetStatus {
  const fixedMonthlyIncome = getFixedMonthlyIncome(
    recurringTransactions,
    referenceDate
  );
  const fixedMonthlyExpenses = getFixedMonthlyExpenses(
    recurringTransactions,
    referenceDate
  );
  const monthlyMinimumSavingsTarget = toMoneyNumber(
    setting.monthlyMinimumSavingsTarget
  );
  const monthlyVariableBudget = getMonthlyVariableBudget(
    fixedMonthlyIncome,
    fixedMonthlyExpenses,
    monthlyMinimumSavingsTarget
  );
  const monthExpenses = getVariableExpensesForMonth(
    transactions,
    referenceDate,
    setting
  );
  const weekExpenses = getVariableExpensesForWeek(
    transactions,
    referenceDate,
    setting
  );
  const monthAvailabilityTransfers =
    getAvailabilityReducingTransfersForMonth(
      transactions,
      referenceDate,
      setting
    );
  const weekAvailabilityTransfers = getAvailabilityReducingTransfersForWeek(
    transactions,
    referenceDate,
    setting
  );
  const monthlyVariableExpense = sumExpenses(monthExpenses);
  const currentWeekVariableExpense = sumExpenses(weekExpenses);
  const monthlyTransferredOutOfAvailable = sumExpenses(
    monthAvailabilityTransfers
  );
  const currentWeekTransferredOutOfAvailable = sumExpenses(
    weekAvailabilityTransfers
  );
  const remainingVariableBudget = roundMoney(
    monthlyVariableBudget -
      monthlyVariableExpense -
      monthlyTransferredOutOfAvailable
  );
  const monthEnd = endOfMonth(referenceDate);
  const monthStart = startOfMonth(referenceDate);
  const weekStart = startOfWeek(referenceDate);
  const weekEnd = endOfWeek(referenceDate);
  const weekRangeStart = maxDate(weekStart, monthStart);
  const weekRangeEnd = minDate(weekEnd, monthEnd);
  const remainingDaysInMonth = countDaysInclusive(
    startOfDay(referenceDate),
    monthEnd
  );
  const priorWeekVariableExpense = sumExpenses(
    monthExpenses.filter(
      (transaction) => new Date(transaction.date) < weekRangeStart
    )
  );
  const priorWeekTransferredOutOfAvailable = sumExpenses(
    monthAvailabilityTransfers.filter(
      (transaction) => new Date(transaction.date) < weekRangeStart
    )
  );
  const remainingVariableBudgetAtWeekStart = roundMoney(
    monthlyVariableBudget -
      priorWeekVariableExpense -
      priorWeekTransferredOutOfAvailable
  );
  const daysInCurrentWeekWithinMonth = countDaysInclusive(
    weekRangeStart,
    weekRangeEnd
  );
  const remainingDaysInCurrentWeekWithinMonth = countDaysInclusive(
    startOfDay(referenceDate),
    weekRangeEnd
  );
  const weeklyAllocationRemainingDaysInMonth = countDaysInclusive(
    weekRangeStart,
    monthEnd
  );

  const dailyAvailableBudget =
    setting.calculationMode === "remaining_days"
      ? divideMoney(
          remainingVariableBudgetAtWeekStart,
          weeklyAllocationRemainingDaysInMonth
        )
      : divideMoney(monthlyVariableBudget, daysInMonth(referenceDate));
  const currentWeekAvailableBudget = roundMoney(
    dailyAvailableBudget * daysInCurrentWeekWithinMonth -
      currentWeekTransferredOutOfAvailable
  );
  const currentWeekDifference = roundMoney(
    currentWeekAvailableBudget - currentWeekVariableExpense
  );
  const percentageUsed =
    currentWeekAvailableBudget > 0
      ? roundPercentage(
          (currentWeekVariableExpense / currentWeekAvailableBudget) * 100
        )
      : null;
  const hasSufficientConfiguration = recurringTransactions.some(
    (transaction) =>
      transaction.isActive &&
      transaction.type === "income" &&
      appliesToMonth(transaction, referenceDate)
  );

  return {
    hasSufficientConfiguration,
    fixedMonthlyIncome,
    fixedMonthlyExpenses,
    monthlyMinimumSavingsTarget,
    monthlyVariableBudget,
    monthlyVariableExpense,
    monthlyTransferredOutOfAvailable,
    remainingVariableBudget,
    remainingDaysInMonth,
    weeklyAllocationRemainingDaysInMonth,
    dailyAvailableBudget,
    weekStart,
    weekEnd,
    daysInCurrentWeekWithinMonth,
    remainingDaysInCurrentWeekWithinMonth,
    currentWeekAvailableBudget,
    currentWeekVariableExpense,
    currentWeekTransferredOutOfAvailable,
    currentWeekDifference,
    percentageUsed,
    message: getStatusMessage({
      currentWeekDifference,
      hasSufficientConfiguration,
      monthlyVariableBudget,
      percentageUsed
    }),
    variableExpensesForWeek: weekExpenses,
    availabilityReducingTransfersForWeek: weekAvailabilityTransfers
  };
}

function sumRecurringTransactions(
  recurringTransactions: RecurringTransactionForBudget[],
  type: "expense" | "income",
  referenceDate: Date
): number {
  return roundMoney(
    recurringTransactions
      .filter(
        (transaction) =>
          transaction.isActive &&
          transaction.type === type &&
          appliesToMonth(transaction, referenceDate)
      )
      .reduce(
        (total, transaction) =>
          total +
          toMoneyNumber(transaction.amount) *
            getOccurrenceCountForMonth(transaction, referenceDate),
        0
      )
  );
}

function appliesToMonth(
  transaction: RecurringTransactionForBudget,
  referenceDate: Date
): boolean {
  return getOccurrenceCountForMonth(transaction, referenceDate) > 0;
}

function getOccurrenceCountForMonth(
  transaction: RecurringTransactionForBudget,
  referenceDate: Date
): number {
  return getScheduledDatesForMonth(
    transaction,
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1
  ).length;
}

function isVariableExpense(
  transaction: VariableExpenseForBudget,
  setting: Pick<
    BudgetSettingForCalculation,
    "includePendingTransactions" | "includeReimbursableExpenses"
  >
): boolean {
  if (transaction.excludeFromWeeklyBudget) {
    return false;
  }

  if (transaction.isPending && !setting.includePendingTransactions) {
    return false;
  }

  if (transaction.recurringOccurrenceId) {
    return false;
  }

  if (transaction.type === "reimbursable_expense") {
    return setting.includeReimbursableExpenses;
  }

  return (
    transaction.type === "expense" &&
    transaction.affectsPersonalExpense &&
    !EXCLUDED_VARIABLE_EXPENSE_TYPES.has(transaction.type)
  );
}

function isAvailabilityReducingTransfer(
  transaction: VariableExpenseForBudget,
  setting: Pick<BudgetSettingForCalculation, "includePendingTransactions">
): boolean {
  if (transaction.excludeFromWeeklyBudget) {
    return false;
  }

  if (transaction.isPending && !setting.includePendingTransactions) {
    return false;
  }

  return (
    transaction.type === "transfer" &&
    transaction.sourceAccountIncludeInAvailableMoney === true &&
    transaction.destinationAccountIncludeInAvailableMoney === false
  );
}

function getStatusMessage({
  currentWeekDifference,
  hasSufficientConfiguration,
  monthlyVariableBudget,
  percentageUsed
}: {
  currentWeekDifference: number;
  hasSufficientConfiguration: boolean;
  monthlyVariableBudget: number;
  percentageUsed: number | null;
}): string {
  if (!hasSufficientConfiguration) {
    return "No hay ingresos fijos recurrentes suficientes para calcular el objetivo semanal.";
  }

  if (monthlyVariableBudget < 0) {
    return "Tus gastos fijos y tu objetivo de ahorro superan los ingresos fijos del mes.";
  }

  if (currentWeekDifference < 0) {
    return `Te has pasado en ${formatEuroAmount(
      Math.abs(currentWeekDifference)
    )} esta semana.`;
  }

  if (percentageUsed !== null && percentageUsed >= 85) {
    return `Cuidado: has usado el ${Math.round(
      percentageUsed
    )}% del presupuesto semanal.`;
  }

  return `Vas bien: te quedan ${formatEuroAmount(
    currentWeekDifference
  )} esta semana.`;
}

function formatEuroAmount(value: number): string {
  return currencyFormatter.format(value);
}

function sumExpenses(transactions: VariableExpenseForBudget[]): number {
  return roundMoney(
    transactions.reduce(
      (total, transaction) => total + toMoneyNumber(transaction.amount),
      0
    )
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysSinceMonday
  );
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    23,
    59,
    59,
    999
  );
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

function countDaysInclusive(start: Date, end: Date): number {
  if (end < start) return 0;

  const startUtc = Date.UTC(
    start.getFullYear(),
    start.getMonth(),
    start.getDate()
  );
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());

  return Math.floor((endUtc - startUtc) / 86_400_000) + 1;
}

function daysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

function minDate(...dates: Date[]): Date {
  return new Date(Math.min(...dates.map((date) => date.getTime())));
}

function maxDate(...dates: Date[]): Date {
  return new Date(Math.max(...dates.map((date) => date.getTime())));
}

function divideMoney(value: number, divisor: number): number {
  return divisor > 0 ? roundMoney(value / divisor) : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}
