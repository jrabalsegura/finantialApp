import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateCategoryTotals,
  calculateDashboardNetWorthVariation,
  calculateProjectedMonthlyCashflow,
  type PendingRecurringOccurrenceForDashboard
} from "./dashboard";

test("agrupa movimientos personales por categoría y ordena por importe", () => {
  const totals = calculateCategoryTotals({
    year: 2026,
    month: 6,
    type: "expense",
    transactions: [
      transaction(20, "2026-06-01", "food", "Supermercado", true, false),
      transaction(30, "2026-06-02", "food", "Supermercado", true, false),
      transaction(80, "2026-06-03", "home", "Casa", true, false),
      transaction(1000, "2026-06-04", "salary", "Nómina", false, true),
      transaction(500, "2026-05-31", "travel", "Viajes", true, false)
    ]
  });

  assert.deepEqual(totals, [
    { categoryId: "home", count: 1, name: "Casa", value: 80 },
    { categoryId: "food", count: 2, name: "Supermercado", value: 50 }
  ]);
});

test("mantiene una agrupación explícita para movimientos sin categoría", () => {
  const totals = calculateCategoryTotals({
    year: 2026,
    month: 6,
    type: "income",
    transactions: [
      transaction(25, "2026-06-01", null, null, false, true),
      transaction(75, "2026-06-02", null, null, false, true)
    ]
  });

  assert.deepEqual(totals, [
    {
      categoryId: "sin-categoria",
      count: 2,
      name: "Sin categoría",
      value: 100
    }
  ]);
});

test("calcula la variación entre los dos últimos cierres mostrados", () => {
  assert.deepEqual(
    calculateDashboardNetWorthVariation([
      { year: 2026, month: 6, netWorth: 1250 },
      { year: 2026, month: 5, netWorth: 1000 }
    ]),
    {
      amount: 250,
      label: "05/2026 → 06/2026"
    }
  );

  assert.equal(
    calculateDashboardNetWorthVariation([
      { year: 2026, month: 6, netWorth: 1250 }
    ]),
    null
  );
});

test("proyecta el ahorro mensual con ingresos y gastos fijos pendientes", () => {
  const cashflow = calculateProjectedMonthlyCashflow({
    actualIncome: 500,
    actualExpense: 60,
    recurringOccurrences: [
      recurringOccurrence(2000, "income", "pending"),
      recurringOccurrence(900, "expense", "pending"),
      recurringOccurrence(300, "transfer", "pending"),
      recurringOccurrence(100, "savings_allocation", "pending"),
      recurringOccurrence(80, "expense", "confirmed")
    ]
  });

  assert.deepEqual(cashflow, {
    income: 2500,
    expense: 960,
    savings: 1540
  });
});

function recurringOccurrence(
  amount: number,
  type: PendingRecurringOccurrenceForDashboard["recurringTransaction"]["type"],
  status: string
): PendingRecurringOccurrenceForDashboard {
  return {
    amount,
    status,
    recurringTransaction: { type }
  };
}

function transaction(
  amount: number,
  date: string,
  categoryId: string | null,
  categoryName: string | null,
  affectsPersonalExpense: boolean,
  affectsPersonalIncome: boolean
) {
  return {
    amount,
    date,
    categoryId,
    category: categoryId
      ? { id: categoryId, name: categoryName ?? categoryId }
      : null,
    affectsPersonalExpense,
    affectsPersonalIncome
  };
}
