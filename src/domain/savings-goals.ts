import {
  toMoneyNumber,
  type MoneyValue
} from "./financial-calculations";
import { normalizeMoney } from "./money";

export type SavingsBucketGoalInput = {
  currentAmount: MoneyValue;
  targetAmount?: MoneyValue | null;
};

export type SavingsBucketGoalProgress = {
  currentAmount: number;
  hasGoal: boolean;
  isCompleted: boolean;
  isOverfunded: boolean;
  overfundedAmount: number;
  percentage: number | null;
  remainingAmount: number | null;
  targetAmount: number | null;
  visualPercentage: number;
};

export function getBucketGoalProgress(
  bucket: SavingsBucketGoalInput
): SavingsBucketGoalProgress {
  const currentAmount = toMoneyNumber(bucket.currentAmount);
  const targetAmount =
    bucket.targetAmount == null ? null : toMoneyNumber(bucket.targetAmount);
  const hasGoal = targetAmount != null && targetAmount > 0;

  if (!hasGoal) {
    return {
      currentAmount,
      hasGoal: false,
      isCompleted: false,
      isOverfunded: false,
      overfundedAmount: 0,
      percentage: null,
      remainingAmount: null,
      targetAmount: null,
      visualPercentage: 0
    };
  }

  const percentage = normalizeMoney((currentAmount / targetAmount) * 100);
  const visualPercentage = Math.min(Math.max(percentage, 0), 100);
  const remainingAmount = Math.max(
    normalizeMoney(targetAmount - currentAmount),
    0
  );
  const overfundedAmount = Math.max(
    normalizeMoney(currentAmount - targetAmount),
    0
  );

  return {
    currentAmount,
    hasGoal: true,
    isCompleted: currentAmount >= targetAmount,
    isOverfunded: currentAmount > targetAmount,
    overfundedAmount,
    percentage,
    remainingAmount,
    targetAmount,
    visualPercentage
  };
}

export function getBucketGoalPercentage(
  bucket: SavingsBucketGoalInput
): number | null {
  return getBucketGoalProgress(bucket).percentage;
}

export function getBucketRemainingAmount(
  bucket: SavingsBucketGoalInput
): number | null {
  return getBucketGoalProgress(bucket).remainingAmount;
}

export function isBucketGoalCompleted(
  bucket: SavingsBucketGoalInput
): boolean {
  return getBucketGoalProgress(bucket).isCompleted;
}

export function isBucketOverfunded(bucket: SavingsBucketGoalInput): boolean {
  return getBucketGoalProgress(bucket).isOverfunded;
}
