ALTER TABLE "AppUser" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Transaction" ADD COLUMN "balanceDelta" DECIMAL;
ALTER TABLE "Transaction" ADD COLUMN "savingsTransferId" TEXT;
UPDATE "Transaction" SET "balanceDelta" = (SELECT "difference" FROM "MonthlyAccountSnapshot" WHERE "adjustmentTransactionId" = "Transaction"."id") WHERE "type" = 'balance_adjustment';
CREATE INDEX "Transaction_date_idx" ON "Transaction"("date");
CREATE INDEX "Transaction_savingsTransferId_idx" ON "Transaction"("savingsTransferId");
ALTER TABLE "BudgetSetting" ADD COLUMN "weeklySpendingCap" DECIMAL NOT NULL DEFAULT 500;
ALTER TABLE "MonthlyClose" ADD COLUMN "deficitFromFreeSavings" DECIMAL NOT NULL DEFAULT 0;

-- Earlier versions wrote the two legs together but omitted an operation id.
-- Only pair unambiguous, adjacent legs with the same amount and description.
CREATE TEMP TABLE review_transfer_pairs AS
SELECT w.id AS source, a.id AS destination FROM "Transaction" w JOIN "Transaction" a
ON a.type = 'savings_allocation' AND w.type = 'savings_withdrawal'
AND w.monthlyCloseId IS NULL AND a.monthlyCloseId IS NULL
AND w.savingsTransferId IS NULL AND a.savingsTransferId IS NULL
AND w.amount = a.amount AND w.accountId = a.accountId
AND w.description IS a.description AND w.savingsBucketId <> a.savingsBucketId
AND ABS(w.date - a.date) <= 2000 AND ABS(w.createdAt - a.createdAt) <= 2000;
DELETE FROM review_transfer_pairs WHERE source IN (SELECT source FROM review_transfer_pairs GROUP BY source HAVING COUNT(*) <> 1) OR destination IN (SELECT destination FROM review_transfer_pairs GROUP BY destination HAVING COUNT(*) <> 1);
UPDATE "Transaction" SET savingsTransferId = 'legacy:' || (SELECT source FROM review_transfer_pairs WHERE source = "Transaction".id OR destination = "Transaction".id)
WHERE id IN (SELECT source FROM review_transfer_pairs UNION SELECT destination FROM review_transfer_pairs);
DROP TABLE review_transfer_pairs;
UPDATE "Transaction" SET reimbursementId = (
 SELECT r.id FROM "Reimbursement" r JOIN "Transaction" original ON original.id = r.originalTransactionId
 WHERE r.status = 'uncollectible' AND original.accountId = "Transaction".accountId
 AND "Transaction".description = 'Convertido en gasto real: ' || r.title
 AND ABS((r.expectedAmount - r.paidAmount) - "Transaction".amount) < 0.001
)
WHERE type = 'expense' AND affectsRealBalance = 0 AND reimbursementId IS NULL
AND (SELECT COUNT(*) FROM "Reimbursement" r JOIN "Transaction" original ON original.id = r.originalTransactionId
 WHERE r.status = 'uncollectible' AND original.accountId = "Transaction".accountId
 AND "Transaction".description = 'Convertido en gasto real: ' || r.title
 AND ABS((r.expectedAmount - r.paidAmount) - "Transaction".amount) < 0.001) = 1;
