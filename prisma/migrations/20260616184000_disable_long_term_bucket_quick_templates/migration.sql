UPDATE "QuickTransactionTemplate"
SET "isActive" = false
WHERE
  "type" = 'savings_allocation'
  AND "savingsBucketId" IN (
    SELECT "id"
    FROM "SavingsBucket"
    WHERE "isLongTerm" = true
  );
