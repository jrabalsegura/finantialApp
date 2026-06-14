import assert from "node:assert/strict";
import test from "node:test";
import { getQuickTransactionRules } from "./transaction-rules";

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
