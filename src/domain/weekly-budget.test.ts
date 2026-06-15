import assert from "node:assert/strict";
import test from "node:test";
import {
  getFixedMonthlyExpenses,
  getFixedMonthlyIncome,
  getAvailabilityReducingTransfersForMonth,
  getMonthlyVariableBudget,
  getVariableExpensesForMonth,
  getVariableExpensesForWeek,
  getWeeklyBudgetStatus,
  type RecurringTransactionForBudget,
  type VariableExpenseForBudget
} from "./weekly-budget";

const recurringTransactions: RecurringTransactionForBudget[] = [
  recurring("salary", "Nómina", "income", 2500, 27),
  recurring("rent", "Alquiler recibido", "income", 800, 5),
  recurring("subscriptions", "Suscripciones", "expense", 500, 20),
  recurring("transfer", "Transferencia", "transfer", 400, 1),
  { ...recurring("inactive", "Antiguo", "expense", 100, 1), isActive: false }
];

const setting = {
  monthlyMinimumSavingsTarget: 300,
  calculationMode: "remaining_days" as const,
  includeReimbursableExpenses: false,
  includePendingTransactions: false
};

test("calcula ingresos y gastos fijos con recurrentes activos del mes aunque aún no hayan vencido", () => {
  const referenceDate = new Date(2026, 5, 10, 12);

  assert.equal(
    getFixedMonthlyIncome(recurringTransactions, referenceDate),
    3300
  );
  assert.equal(
    getFixedMonthlyExpenses(recurringTransactions, referenceDate),
    500
  );
  assert.equal(getMonthlyVariableBudget(3300, 500, 300), 2500);
});

test("convierte recurrentes semanales en el total exacto de ocurrencias del mes", () => {
  const weeklyRecurring = [
    weeklyRecurringItem("weekly-income", "Clases", "income", 100, 1),
    weeklyRecurringItem("weekly-expense", "Transporte", "expense", 25, 1)
  ];
  const referenceDate = new Date(2026, 5, 10, 12);

  assert.equal(getFixedMonthlyIncome(weeklyRecurring, referenceDate), 500);
  assert.equal(getFixedMonthlyExpenses(weeklyRecurring, referenceDate), 125);
});

test("excluye del gasto variable fijos confirmados y tipos técnicos", () => {
  const transactions: VariableExpenseForBudget[] = [
    expense("variable", 100, "2026-06-03"),
    {
      ...expense("fixed", 50, "2026-06-04"),
      recurringOccurrenceId: "occurrence-1"
    },
    expense("adjustment", 20, "2026-06-05", "balance_adjustment"),
    expense("transfer", 300, "2026-06-06", "transfer"),
    expense("reimbursable", 80, "2026-06-07", "reimbursable_expense")
  ];

  assert.deepEqual(
    getVariableExpensesForMonth(
      transactions,
      new Date(2026, 5, 10, 12),
      setting
    ).map((transaction) => transaction.id),
    ["variable"]
  );
});

test("puede incluir reembolsables y pendientes cuando la configuración lo permite", () => {
  const transactions: VariableExpenseForBudget[] = [
    expense("reimbursable", 80, "2026-06-07", "reimbursable_expense"),
    { ...expense("pending", 25, "2026-06-08"), isPending: true }
  ];

  assert.equal(
    getVariableExpensesForMonth(
      transactions,
      new Date(2026, 5, 10, 12),
      {
        includeReimbursableExpenses: true,
        includePendingTransactions: true
      }
    ).length,
    2
  );
});

test("solo las transferencias desde disponible hacia no disponible reducen el presupuesto", () => {
  const transactions: VariableExpenseForBudget[] = [
    transfer("pension", 100, true, false),
    transfer("between-available", 200, true, true),
    transfer("release-savings", 300, false, true),
    transfer("between-investments", 400, false, false)
  ];

  assert.deepEqual(
    getAvailabilityReducingTransfersForMonth(
      transactions,
      new Date(2026, 5, 10, 12),
      setting
    ).map((transaction) => transaction.id),
    ["pension"]
  );
});

test("la semana empieza en lunes y se limita al mes actual", () => {
  const transactions = [
    expense("sunday-before", 10, "2026-05-31"),
    expense("monday", 20, "2026-06-01"),
    expense("today", 30, "2026-06-03"),
    expense("future", 40, "2026-06-05")
  ];

  assert.deepEqual(
    getVariableExpensesForWeek(
      transactions,
      new Date(2026, 5, 3, 12),
      setting
    ).map((transaction) => transaction.id),
    ["monday", "today"]
  );
});

test("calcula el objetivo semanal en modo días restantes", () => {
  const transactions = [
    expense("previous-week", 620, "2026-06-02"),
    expense("week-1", 100, "2026-06-08"),
    expense("week-2", 80, "2026-06-10")
  ];
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions,
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.monthlyVariableBudget, 2500);
  assert.equal(status.monthlyVariableExpense, 800);
  assert.equal(status.remainingVariableBudget, 1700);
  assert.equal(status.remainingDaysInMonth, 21);
  assert.equal(status.dailyAvailableBudget, 80.95);
  assert.equal(status.remainingDaysInCurrentWeekWithinMonth, 5);
  assert.equal(status.currentWeekAvailableBudget, 404.75);
  assert.equal(status.currentWeekVariableExpense, 180);
  assert.equal(status.currentWeekDifference, 224.75);
  assert.equal(status.percentageUsed, 44.5);
});

test("reparte proporcionalmente todos los días de la semana en modo mes completo", () => {
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions: [],
    setting: {
      ...setting,
      calculationMode: "full_month_proportional"
    },
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.dailyAvailableBudget, 83.33);
  assert.equal(status.daysInCurrentWeekWithinMonth, 7);
  assert.equal(status.currentWeekAvailableBudget, 583.31);
});

test("una transferencia a pensiones reduce el disponible sin sumarse otra vez al gasto semanal", () => {
  const transactions = [
    expense("week-expense", 180, "2026-06-10"),
    transfer("pension", 210, true, false, "2026-06-10")
  ];
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions,
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.monthlyVariableExpense, 180);
  assert.equal(status.monthlyTransferredOutOfAvailable, 210);
  assert.equal(status.remainingVariableBudget, 2110);
  assert.equal(status.currentWeekVariableExpense, 180);
  assert.equal(status.currentWeekTransferredOutOfAvailable, 210);
  assert.equal(status.currentWeekDifference, 322.4);
  assert.equal(status.percentageUsed, 35.8);
});

test("muestra estado vacío sin ingresos recurrentes y advierte presupuesto negativo", () => {
  const empty = getWeeklyBudgetStatus({
    recurringTransactions: [],
    transactions: [],
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });
  const negative = getWeeklyBudgetStatus({
    recurringTransactions: [
      recurring("income", "Ingreso", "income", 100, 1),
      recurring("expense", "Gasto", "expense", 500, 1)
    ],
    transactions: [],
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(empty.hasSufficientConfiguration, false);
  assert.match(empty.message, /No hay ingresos fijos/);
  assert.equal(negative.monthlyVariableBudget, -700);
  assert.match(negative.message, /superan los ingresos/);
});

function recurring(
  id: string,
  name: string,
  type: RecurringTransactionForBudget["type"],
  amount: number,
  dayOfMonth: number
): RecurringTransactionForBudget {
  return {
    id,
    name,
    type,
    amount,
    dayOfMonth,
    startDate: new Date(2026, 0, 1, 12),
    endDate: null,
    isActive: true
  };
}

function expense(
  id: string,
  amount: number,
  date: string,
  type: VariableExpenseForBudget["type"] = "expense"
): VariableExpenseForBudget {
  return {
    id,
    amount,
    date: new Date(`${date}T12:00:00`),
    type,
    affectsPersonalExpense: type === "expense"
  };
}

function weeklyRecurringItem(
  id: string,
  name: string,
  type: RecurringTransactionForBudget["type"],
  amount: number,
  dayOfWeek: number
): RecurringTransactionForBudget {
  return {
    id,
    name,
    type,
    amount,
    frequency: "weekly",
    dayOfMonth: 1,
    dayOfWeek,
    startDate: new Date(2026, 0, 1, 12),
    endDate: null,
    isActive: true
  };
}

function transfer(
  id: string,
  amount: number,
  sourceAvailable: boolean,
  destinationAvailable: boolean,
  date = "2026-06-10"
): VariableExpenseForBudget {
  return {
    id,
    amount,
    date: new Date(`${date}T12:00:00`),
    type: "transfer",
    affectsPersonalExpense: false,
    sourceAccountIncludeInAvailableMoney: sourceAvailable,
    destinationAccountIncludeInAvailableMoney: destinationAvailable
  };
}
