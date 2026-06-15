import assert from "node:assert/strict";
import test from "node:test";
import {
  getConvertReimbursementToExpenseRules,
  getQuickTransactionRules,
  getReimbursementTransactionRules
} from "./transaction-rules";

test("gasto normal reduce la cuenta y afecta a gasto, ahorro y patrimonio", () => {
  const rules = getQuickTransactionRules({
    type: "expense",
    amount: 25,
    accountId: "openbank"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "openbank", delta: -25 }
  ]);
  assert.equal(rules.impact.affectsPersonalExpense, true);
  assert.equal(rules.impact.affectsMonthlySavings, true);
  assert.equal(rules.impact.affectsNetWorth, true);
});

test("ingreso normal aumenta la cuenta y afecta a ingreso, ahorro y patrimonio", () => {
  const rules = getQuickTransactionRules({
    type: "income",
    amount: 1000,
    accountId: "openbank"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "openbank", delta: 1000 }
  ]);
  assert.equal(rules.impact.affectsPersonalIncome, true);
  assert.equal(rules.impact.affectsMonthlySavings, true);
  assert.equal(rules.impact.affectsNetWorth, true);
});

test("transferencia mueve saldos pero no afecta a ahorro ni patrimonio total", () => {
  const rules = getQuickTransactionRules({
    type: "transfer",
    amount: 300,
    accountId: "openbank",
    destinationAccountId: "ahorro"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "openbank", delta: -300 },
    { accountId: "ahorro", delta: 300 }
  ]);
  assert.equal(rules.impact.affectsPersonalExpense, false);
  assert.equal(rules.impact.affectsPersonalIncome, false);
  assert.equal(rules.impact.affectsMonthlySavings, false);
  assert.equal(rules.impact.affectsNetWorth, false);
});

test("transferencia exige destino distinto", () => {
  assert.throws(
    () =>
      getQuickTransactionRules({
        type: "transfer",
        amount: 10,
        accountId: "openbank",
        destinationAccountId: "openbank"
      }),
    /distinta/
  );
});

test("gasto reembolsable baja saldo sin contar como gasto ni ahorro", () => {
  const rules = getReimbursementTransactionRules({
    type: "reimbursable_expense",
    amount: 120,
    accountId: "openbank"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "openbank", delta: -120 }
  ]);
  assert.equal(rules.impact.affectsPersonalExpense, false);
  assert.equal(rules.impact.affectsMonthlySavings, false);
  assert.equal(rules.impact.affectsNetWorth, false);
});

test("cobro de reembolso sube saldo sin contar como ingreso ni ahorro", () => {
  const rules = getReimbursementTransactionRules({
    type: "reimbursement_income",
    amount: 50,
    accountId: "openbank"
  });

  assert.deepEqual(rules.balanceDeltas, [
    { accountId: "openbank", delta: 50 }
  ]);
  assert.equal(rules.impact.affectsPersonalIncome, false);
  assert.equal(rules.impact.affectsMonthlySavings, false);
  assert.equal(rules.impact.affectsNetWorth, false);
});

test("asignación rápida incrementa la partida sin tocar cuentas", () => {
  const rules = getQuickTransactionRules({
    type: "savings_allocation",
    amount: 200,
    accountId: "openbank",
    savingsBucketId: "reserva"
  });

  assert.deepEqual(rules.balanceDeltas, []);
  assert.equal(rules.savingsBucketDelta, 200);
  assert.equal(rules.impact.affectsRealBalance, false);
  assert.equal(rules.impact.affectsMonthlySavings, false);
});

test("conversion a gasto real cuenta como gasto sin volver a tocar saldo bancario", () => {
  const rules = getConvertReimbursementToExpenseRules({
    pendingAmount: 80,
    accountId: "openbank"
  });

  assert.deepEqual(rules.balanceDeltas, []);
  assert.equal(rules.impact.affectsRealBalance, false);
  assert.equal(rules.impact.affectsPersonalExpense, true);
  assert.equal(rules.impact.affectsMonthlySavings, true);
  assert.equal(rules.impact.affectsNetWorth, false);
});
