import type { Prisma } from "@prisma/client";

const statements = `-- Earlier versions wrote the two legs together but omitted an operation id.
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
`;

export async function restoreLegacyFinancialLinks(
  tx: Prisma.TransactionClient
) {
  for (const sql of statements.split(";").filter((value) => value.trim()))
    await tx.$executeRawUnsafe(sql);
}
