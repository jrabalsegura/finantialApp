ALTER TABLE "Transaction" ADD COLUMN "weeklyBudgetImpactScope" TEXT NOT NULL DEFAULT 'normal';

UPDATE "Transaction"
SET "weeklyBudgetImpactScope" = 'exclude_weekly_and_monthly'
WHERE "excludeFromWeeklyBudget" = true;

ALTER TABLE "Transaction" DROP COLUMN "excludeFromWeeklyBudget";
