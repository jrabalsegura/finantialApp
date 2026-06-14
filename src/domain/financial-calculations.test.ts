import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableMoney,
  calculateNetWorth,
  calculatePendingReimbursements,
  calculateRealMonthlyExpense,
  calculateRealMonthlyIncome,
  calculateRealMonthlySavings,
  getDefaultTransactionImpact,
  isTransactionInMonth,
  transactionAffectsMonthlySavings,
  transactionAffectsNetWorth,
  type AccountForCalculations,
  type ReimbursementForCalculations,
  type TransactionForCalculations,
  type TransactionType
} from "./financial-calculations";

const accounts: AccountForCalculations[] = [
  {
    currentBalance: 1000,
    includeInAvailableMoney: true,
    includeInNetWorth: true
  },
  {
    currentBalance: "500.50",
    includeInAvailableMoney: true,
    includeInNetWorth: true
  },
  {
    currentBalance: 10000,
    includeInAvailableMoney: false,
    includeInNetWorth: true
  },
  {
    currentBalance: 750,
    includeInAvailableMoney: false,
    includeInNetWorth: false
  }
];

const transactions: TransactionForCalculations[] = [
  transaction("income", 3000, "2026-06-01", {
    affectsPersonalIncome: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  }),
  transaction("expense", 100, "2026-06-02", {
    affectsPersonalExpense: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  }),
  transaction("transfer", 250, "2026-06-03"),
  transaction("reimbursable_expense", 120, "2026-06-04"),
  transaction("reimbursement_income", 40, "2026-06-05"),
  transaction("investment_gain", 200, "2026-06-06", {
    affectsNetWorth: true
  }),
  transaction("investment_loss", 50, "2026-06-07", {
    affectsNetWorth: true
  }),
  transaction("balance_adjustment", 30, "2026-06-08", {
    affectsPersonalExpense: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  }),
  transaction("income", 999, "2026-05-31", {
    affectsPersonalIncome: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  })
];

const reimbursements: ReimbursementForCalculations[] = [
  reimbursement("r1", 120, 40, "pending"),
  reimbursement("r2", 50, 20, "partially_paid"),
  reimbursement("r3", 30, 30, "paid"),
  reimbursement("r4", 100, 0, "cancelled"),
  reimbursement("r5", 100, 0, "uncollectible")
];

test("calcula dinero disponible usando solo cuentas marcadas como disponibles", () => {
  assert.equal(calculateAvailableMoney(accounts), 1500.5);
});

test("calcula patrimonio total con cuentas patrimoniales y pendientes de cobrar vivos", () => {
  assert.equal(calculateNetWorth(accounts, reimbursements), 11610.5);
});

test("calcula ingresos, gastos y ahorro mensual real por flags y mes", () => {
  assert.equal(calculateRealMonthlyIncome(transactions, 2026, 6), 3000);
  assert.equal(calculateRealMonthlyExpense(transactions, 2026, 6), 130);
  assert.equal(calculateRealMonthlySavings(transactions, 2026, 6), 2870);
});

test("excluye transferencias, reembolsos e inversiones del ahorro mensual", () => {
  assert.equal(calculateRealMonthlyIncome(transactions, 2026, 5), 999);
  assert.equal(calculateRealMonthlyExpense(transactions, 2026, 5), 0);
  assert.equal(calculateRealMonthlySavings(transactions, 2026, 5), 999);
});

test("resume pendientes de reembolso cobrables", () => {
  const summary = calculatePendingReimbursements(reimbursements);

  assert.equal(summary.count, 2);
  assert.equal(summary.totalPending, 110);
  assert.deepEqual(
    summary.items.map((item) => [item.id, item.pendingAmount]),
    [
      ["r1", 80],
      ["r2", 30]
    ]
  );
});

test("distingue impacto por tipo de movimiento", () => {
  assert.equal(getDefaultTransactionImpact("expense").affectsMonthlySavings, true);
  assert.equal(
    getDefaultTransactionImpact("reimbursable_expense")
      .affectsMonthlySavings,
    false
  );
  assert.equal(getDefaultTransactionImpact("investment_gain").affectsNetWorth, true);
  assert.equal(getDefaultTransactionImpact("transfer").affectsNetWorth, false);
});

test("expone predicados explicitos para ahorro mensual y patrimonio", () => {
  const expense = transactions[1];
  const investmentGain = transactions[5];
  const transfer = transactions[2];

  assert.equal(transactionAffectsMonthlySavings(expense), true);
  assert.equal(transactionAffectsMonthlySavings(investmentGain), false);
  assert.equal(transactionAffectsNetWorth(investmentGain), true);
  assert.equal(transactionAffectsNetWorth(transfer), false);
});

test("usa meses naturales con limite superior exclusivo", () => {
  assert.equal(
    isTransactionInMonth(transaction("income", 1, "2026-06-30T23:59:59"), 2026, 6),
    true
  );
  assert.equal(
    isTransactionInMonth(transaction("income", 1, "2026-07-01T00:00:00"), 2026, 6),
    false
  );
});

function transaction(
  type: TransactionType,
  amount: number,
  date: string,
  impact: Partial<Omit<TransactionForCalculations, "type" | "amount" | "date">> = {}
): TransactionForCalculations {
  return {
    type,
    amount,
    date: new Date(date),
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false,
    ...impact
  };
}

function reimbursement(
  id: string,
  expectedAmount: number,
  paidAmount: number,
  status: ReimbursementForCalculations["status"]
): ReimbursementForCalculations {
  return {
    id,
    title: `Reembolso ${id}`,
    personName: "Inquilino",
    expectedAmount,
    paidAmount,
    status,
    dueDate: null
  };
}
