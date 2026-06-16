import assert from "node:assert/strict";
import test from "node:test";
import {
  getBucketGoalPercentage,
  getBucketGoalProgress,
  getBucketRemainingAmount,
  isBucketGoalCompleted,
  isBucketOverfunded
} from "./savings-goals";

test("detecta partidas sin objetivo configurado", () => {
  const progress = getBucketGoalProgress({
    currentAmount: 500,
    targetAmount: null
  });

  assert.equal(progress.hasGoal, false);
  assert.equal(progress.percentage, null);
  assert.equal(progress.remainingAmount, null);
  assert.equal(progress.visualPercentage, 0);
});

test("trata objetivo cero como no configurado", () => {
  assert.equal(
    getBucketGoalProgress({ currentAmount: 500, targetAmount: 0 }).hasGoal,
    false
  );
});

test("calcula porcentaje y restante de una partida con objetivo", () => {
  const bucket = { currentAmount: 1000, targetAmount: 2000 };

  assert.equal(getBucketGoalPercentage(bucket), 50);
  assert.equal(getBucketRemainingAmount(bucket), 1000);
  assert.equal(isBucketGoalCompleted(bucket), false);
  assert.equal(isBucketOverfunded(bucket), false);
});

test("identifica objetivos completados y excedentes", () => {
  const progress = getBucketGoalProgress({
    currentAmount: 3200,
    targetAmount: 3000
  });

  assert.equal(progress.percentage, 106.67);
  assert.equal(progress.visualPercentage, 100);
  assert.equal(progress.remainingAmount, 0);
  assert.equal(progress.overfundedAmount, 200);
  assert.equal(isBucketGoalCompleted(progress), true);
  assert.equal(isBucketOverfunded(progress), true);
});

test("mantiene importes negativos pero limita la barra visual a cero", () => {
  const progress = getBucketGoalProgress({
    currentAmount: -100,
    targetAmount: 1000
  });

  assert.equal(progress.currentAmount, -100);
  assert.equal(progress.percentage, -10);
  assert.equal(progress.visualPercentage, 0);
  assert.equal(progress.remainingAmount, 1100);
});
