UPDATE "BudgetSetting"
SET
    "savingsBucketId" = (
        SELECT "id"
        FROM "SavingsBucket"
        WHERE "name" = 'Hipoteca / coche'
        LIMIT 1
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'default'
  AND "savingsBucketId" IS NULL;
