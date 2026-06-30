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

test("excluye movimientos marcados del objetivo semanal", () => {
  const transactions: VariableExpenseForBudget[] = [
    expense("regular", 80, "2026-06-10"),
    {
      ...expense("extra-expense", 300, "2026-06-10"),
      weeklyBudgetImpactScope: "exclude_weekly_and_monthly"
    },
    {
      ...transfer("extra-transfer", 500, true, false, "2026-06-10"),
      weeklyBudgetImpactScope: "exclude_weekly_and_monthly"
    }
  ];
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions,
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.monthlyVariableExpense, 80);
  assert.equal(status.monthlyTransferredOutOfAvailable, 0);
  assert.equal(status.currentWeekVariableExpense, 80);
  assert.equal(status.currentWeekBudgetAdjustment, 0);
  assert.deepEqual(
    status.variableExpensesForWeek.map((transaction) => transaction.id),
    ["regular"]
  );
  assert.deepEqual(status.availabilityReducingTransfersForWeek, []);
});

test("puede excluir un gasto del gasto semanal pero restarlo del disponible y del mes", () => {
  const transactions: VariableExpenseForBudget[] = [
    expense("regular", 80, "2026-06-10"),
    {
      ...expense("special", 120, "2026-06-10"),
      weeklyBudgetImpactScope: "exclude_weekly_expense"
    }
  ];
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions,
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.monthlyVariableExpense, 200);
  assert.equal(status.currentWeekVariableExpense, 80);
  assert.equal(status.currentWeekBudgetAdjustment, 120);
  assert.equal(status.currentWeekAvailableBudget, 640.9);
  assert.equal(status.currentWeekDifference, 560.9);
  assert.deepEqual(
    status.variableExpensesForWeek.map((transaction) => transaction.id),
    ["regular"]
  );
  assert.deepEqual(
    status.budgetAdjustingExpensesForWeek.map((transaction) => transaction.id),
    ["special"]
  );
});

test("ignora ingresos puntuales por defecto en el objetivo semanal", () => {
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions: [income("extra", 300, "2026-06-10")],
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.monthlyExtraIncome, 0);
  assert.equal(status.currentWeekExtraIncome, 0);
  assert.equal(status.remainingVariableBudget, 2500);
  assert.equal(status.currentWeekAvailableBudget, 760.9);
});

test("puede incluir un ingreso extra en el presupuesto mensual y semanal", () => {
  const status = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions: [
      {
        ...income("extra", 300, "2026-06-10"),
        weeklyBudgetImpactScope: "include_weekly_and_monthly_income"
      }
    ],
    setting,
    referenceDate: new Date(2026, 5, 10, 12)
  });

  assert.equal(status.monthlyExtraIncome, 300);
  assert.equal(status.currentWeekExtraIncome, 300);
  assert.equal(status.remainingVariableBudget, 2800);
  assert.equal(status.currentWeekAvailableBudget, 1060.9);
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

test("calcula el objetivo semanal en modo días restantes sin reducirlo a mitad de semana", () => {
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
  assert.equal(status.weeklyAllocationRemainingDaysInMonth, 23);
  assert.equal(status.dailyAvailableBudget, 81.74);
  assert.equal(status.daysInCurrentWeekWithinMonth, 7);
  assert.equal(status.remainingDaysInCurrentWeekWithinMonth, 5);
  assert.equal(status.currentWeekAvailableBudget, 572.18);
  assert.equal(status.currentWeekVariableExpense, 180);
  assert.equal(status.currentWeekDifference, 392.18);
  assert.equal(status.percentageUsed, 31.5);
});

test("mantiene el mismo disponible semanal al pasar de lunes a martes sin nuevos movimientos", () => {
  const mondayStatus = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions: [],
    setting,
    referenceDate: new Date(2026, 5, 8, 12)
  });
  const tuesdayStatus = getWeeklyBudgetStatus({
    recurringTransactions,
    transactions: [],
    setting,
    referenceDate: new Date(2026, 5, 9, 12)
  });

  assert.equal(mondayStatus.currentWeekAvailableBudget, 760.9);
  assert.equal(tuesdayStatus.currentWeekAvailableBudget, 760.9);
  assert.equal(tuesdayStatus.currentWeekDifference, 760.9);
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
  assert.equal(status.currentWeekAvailableBudget, 550.9);
  assert.equal(status.currentWeekDifference, 370.9);
  assert.equal(status.percentageUsed, 32.7);
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

function income(
  id: string,
  amount: number,
  date: string
): VariableExpenseForBudget {
  return {
    id,
    amount,
    date: new Date(`${date}T12:00:00`),
    type: "income",
    affectsPersonalExpense: false,
    affectsPersonalIncome: true
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
