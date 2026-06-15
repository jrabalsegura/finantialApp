import assert from "node:assert/strict";
import test from "node:test";
import {
  getNextScheduledDate,
  getRecurringTransactionRules,
  getScheduledDate,
  getScheduledDatesForMonth,
  shouldGenerateRecurringTransaction,
  validateRecurringDateRange
} from "./recurring-transactions";

test("ajusta el día previsto al último día de meses cortos", () => {
  assert.equal(getScheduledDate(2026, 2, 31).getDate(), 28);
  assert.equal(getScheduledDate(2028, 2, 31).getDate(), 29);
});

test("solo genera una plantilla cuando su fecha mensual cae en el rango activo", () => {
  const template = {
    dayOfMonth: 5,
    startDate: new Date(2026, 5, 10),
    endDate: new Date(2026, 7, 5)
  };

  assert.equal(shouldGenerateRecurringTransaction(template, 2026, 6), false);
  assert.equal(shouldGenerateRecurringTransaction(template, 2026, 7), true);
  assert.equal(shouldGenerateRecurringTransaction(template, 2026, 8), true);
  assert.equal(shouldGenerateRecurringTransaction(template, 2026, 9), false);
});

test("calcula la próxima fecha prevista desde hoy o desde el inicio", () => {
  const nextDate = getNextScheduledDate(
    {
      dayOfMonth: 1,
      startDate: new Date(2026, 6, 15)
    },
    new Date(2026, 5, 14)
  );

  assert.equal(nextDate?.getFullYear(), 2026);
  assert.equal(nextDate?.getMonth(), 7);
  assert.equal(nextDate?.getDate(), 1);
});

test("genera todas las ocurrencias semanales del día elegido dentro del mes", () => {
  const dates = getScheduledDatesForMonth(
    {
      frequency: "weekly",
      dayOfMonth: 1,
      dayOfWeek: 1,
      startDate: new Date(2026, 5, 1)
    },
    2026,
    6
  );

  assert.deepEqual(
    dates.map((date) => date.getDate()),
    [1, 8, 15, 22, 29]
  );
});

test("una recurrencia semanal respeta las fechas de inicio y fin", () => {
  const dates = getScheduledDatesForMonth(
    {
      frequency: "weekly",
      dayOfMonth: 1,
      dayOfWeek: 1,
      startDate: new Date(2026, 5, 10),
      endDate: new Date(2026, 5, 23)
    },
    2026,
    6
  );

  assert.deepEqual(
    dates.map((date) => date.getDate()),
    [15, 22]
  );
});

test("calcula la próxima fecha semanal desde el día de referencia", () => {
  const nextDate = getNextScheduledDate(
    {
      frequency: "weekly",
      dayOfMonth: 1,
      dayOfWeek: 1,
      startDate: new Date(2026, 5, 1)
    },
    new Date(2026, 5, 16)
  );

  assert.equal(nextDate?.getFullYear(), 2026);
  assert.equal(nextDate?.getMonth(), 5);
  assert.equal(nextDate?.getDate(), 22);
});

test("una ocurrencia de gasto reutiliza las reglas financieras normales", () => {
  const rules = getRecurringTransactionRules({
    type: "expense",
    amount: 50,
    accountId: "principal"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "principal", delta: -50 }
  ]);
  assert.equal(rules.impact.affectsPersonalExpense, true);
  assert.equal(rules.impact.affectsMonthlySavings, true);
});

test("una transferencia recurrente no afecta a gasto ni ahorro", () => {
  const rules = getRecurringTransactionRules({
    type: "transfer",
    amount: 300,
    accountId: "principal",
    destinationAccountId: "ahorro"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "principal", delta: -300 },
    { accountId: "ahorro", delta: 300 }
  ]);
  assert.equal(rules.impact.affectsPersonalExpense, false);
  assert.equal(rules.impact.affectsMonthlySavings, false);
});

test("una asignación recurrente solo incrementa la partida mental", () => {
  const rules = getRecurringTransactionRules({
    type: "savings_allocation",
    amount: 200,
    accountId: "principal",
    savingsBucketId: "largo-plazo"
  });

  assert.deepEqual(rules.balanceDeltas, []);
  assert.equal(rules.savingsBucketDelta, 200);
  assert.equal(rules.impact.affectsRealBalance, false);
  assert.equal(rules.impact.affectsPersonalExpense, false);
});

test("rechaza rangos de fechas invertidos", () => {
  assert.throws(
    () =>
      validateRecurringDateRange(
        new Date(2026, 5, 10),
        new Date(2026, 5, 9)
      ),
    /anterior/
  );
});
