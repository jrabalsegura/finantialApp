import assert from "node:assert/strict";
import test from "node:test";
import {
  formatPlainAmount,
  normalizeMoney,
  parseMoneyInput
} from "./money";
import { formatCurrencyEUR } from "../lib/formatters";

test("normalizes floating point artifacts to cents", () => {
  assert.equal(normalizeMoney(1268.0200000000004), 1268.02);
  assert.equal(normalizeMoney(99.99999999999999), 100);
  assert.equal(normalizeMoney(-1.005), -1.01);
});

test("parses Spanish and HTML number input formats", () => {
  assert.equal(parseMoneyInput("1.268,02"), 1268.02);
  assert.equal(parseMoneyInput("1268.02"), 1268.02);
  assert.equal(parseMoneyInput("100"), 100);
  assert.ok(Number.isNaN(parseMoneyInput("")));
});

test("formats values for money inputs with exactly two decimals", () => {
  assert.equal(formatPlainAmount(100), "100.00");
  assert.equal(formatPlainAmount(1268.0200000000004), "1268.02");
});

test("formats euros with Spanish decimals and forced thousands grouping", () => {
  assert.equal(formatCurrencyEUR(1268.0200000000004), "1.268,02 €");
  assert.equal(formatCurrencyEUR(99.99999999999999), "100,00 €");
});
