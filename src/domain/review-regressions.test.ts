import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateRealMonthlySavings,
  getDeficitFunding,
  validatePositiveBucketAllocations,
  type TransactionForCalculations
} from "./financial-calculations";
import { calculateProjectedMonthlyCashflow } from "./dashboard";
import {
  getFixedMonthlyExpenses,
  type RecurringTransactionForBudget
} from "./weekly-budget";

const expense: TransactionForCalculations = {
  date: "2026-06-10T12:00:00",
  amount: 100,
  type: "expense",
  affectsPersonalExpense: true,
  affectsPersonalIncome: false,
  affectsMonthlySavings: true,
  affectsNetWorth: true
};

test("el reparto de céntimos no falla por sumar 0,10 y 0,20", () => {
  assert.doesNotThrow(() =>
    validatePositiveBucketAllocations(
      [
        { bucketId: "a", amount: 0.1 },
        { bucketId: "b", amount: 0.2 }
      ],
      0.3
    )
  );
  assert.equal(
    calculateRealMonthlySavings(
      [
        { ...expense, amount: 0.1 },
        { ...expense, amount: 0.2 }
      ],
      2026,
      6
    ),
    -0.3
  );
});

test("los ingresos y gastos de cuentas excluidas no alteran el ahorro mensual", () => {
  assert.equal(
    calculateRealMonthlySavings(
      [
        expense,
        {
          ...expense,
          amount: 250,
          account: { includeInMonthlySavings: false }
        },
        {
          ...expense,
          type: "income",
          affectsPersonalExpense: false,
          affectsPersonalIncome: true,
          amount: 1000,
          account: { includeInMonthlySavings: false }
        }
      ],
      2026,
      6
    ),
    -100
  );
});

test("el ahorro proyectado respeta la exclusión de cuentas y plantillas desactivadas", () => {
  const projected = calculateProjectedMonthlyCashflow({
    actualIncome: 1000,
    actualExpense: 100,
    actualSavings: 500,
    recurringOccurrences: [
      {
        amount: 200,
        status: "pending",
        recurringTransaction: {
          type: "expense",
          account: { includeInMonthlySavings: false }
        }
      },
      {
        amount: 50,
        status: "pending",
        recurringTransaction: { type: "expense", isActive: false }
      }
    ]
  });
  assert.equal(projected.savings, 500);
  assert.equal(projected.expense, 300);
});

test("cubrir el déficit distingue ahorro libre, cobertura parcial y ausencia de reserva", () => {
  assert.deepEqual(getDeficitFunding(100, 500, 0), {
    fromFreeSavings: 100,
    fromBuckets: 0
  });
  assert.deepEqual(getDeficitFunding(100, 450, 500), {
    fromFreeSavings: 50,
    fromBuckets: 50
  });
  assert.deepEqual(getDeficitFunding(100, 400, 500), {
    fromFreeSavings: 0,
    fromBuckets: 100
  });
});

test("un recurrente confirmado en otro mes usa su fecha e importe efectivos", () => {
  const template: RecurringTransactionForBudget = {
    id: "a",
    name: "Factura",
    type: "expense",
    amount: 100,
    dayOfMonth: 20,
    frequency: "monthly",
    startDate: "2026-06-01T12:00:00",
    isActive: false,
    occurrences: [
      {
        scheduledDate: "2026-06-20T12:00:00",
        amount: 150,
        status: "confirmed",
        generatedTransaction: { amount: 150, date: "2026-07-01T12:00:00" }
      }
    ]
  };
  assert.equal(
    getFixedMonthlyExpenses([template], new Date("2026-06-15T12:00:00")),
    0
  );
  assert.equal(
    getFixedMonthlyExpenses([template], new Date("2026-07-15T12:00:00")),
    150
  );
});
