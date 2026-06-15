ALTER TABLE "RecurringTransaction" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "RecurringTransaction" ADD COLUMN "dayOfWeek" INTEGER NOT NULL DEFAULT 1;

DROP INDEX "RecurringTransactionOccurrence_recurringTransactionId_year_month_key";

CREATE UNIQUE INDEX "RecurringTransactionOccurrence_recurringTransactionId_scheduledDate_key"
ON "RecurringTransactionOccurrence"("recurringTransactionId", "scheduledDate");
