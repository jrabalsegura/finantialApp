PRAGMA foreign_keys=OFF;

-- RedefineTables
CREATE TABLE "new_Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" DECIMAL NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "accountId" TEXT NOT NULL,
  "destinationAccountId" TEXT,
  "categoryId" TEXT,
  "savingsBucketId" TEXT,
  "monthlyCloseId" TEXT,
  "affectsRealBalance" BOOLEAN NOT NULL DEFAULT true,
  "affectsPersonalExpense" BOOLEAN NOT NULL DEFAULT false,
  "affectsPersonalIncome" BOOLEAN NOT NULL DEFAULT false,
  "affectsMonthlySavings" BOOLEAN NOT NULL DEFAULT false,
  "affectsNetWorth" BOOLEAN NOT NULL DEFAULT true,
  "reimbursementId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Transaction_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_savingsBucketId_fkey" FOREIGN KEY ("savingsBucketId") REFERENCES "SavingsBucket" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_monthlyCloseId_fkey" FOREIGN KEY ("monthlyCloseId") REFERENCES "MonthlyClose" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Transaction_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Transaction" (
  "id",
  "date",
  "amount",
  "type",
  "description",
  "accountId",
  "destinationAccountId",
  "categoryId",
  "savingsBucketId",
  "monthlyCloseId",
  "affectsRealBalance",
  "affectsPersonalExpense",
  "affectsPersonalIncome",
  "affectsMonthlySavings",
  "affectsNetWorth",
  "reimbursementId",
  "createdAt",
  "updatedAt"
)
SELECT
  "id",
  "date",
  "amount",
  "type",
  "description",
  "accountId",
  "destinationAccountId",
  "categoryId",
  "savingsBucketId",
  NULL,
  "affectsRealBalance",
  "affectsPersonalExpense",
  "affectsPersonalIncome",
  "affectsMonthlySavings",
  "affectsNetWorth",
  "reimbursementId",
  "createdAt",
  "updatedAt"
FROM "Transaction";

DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";

UPDATE "Transaction"
SET "monthlyCloseId" = (
  SELECT "MonthlyClose"."id"
  FROM "MonthlyClose"
  WHERE
    "Transaction"."description" = 'Reparto cierre ' || printf('%02d', "MonthlyClose"."month") || '/' || "MonthlyClose"."year"
    OR "Transaction"."description" = 'Reducción cierre negativo ' || printf('%02d', "MonthlyClose"."month") || '/' || "MonthlyClose"."year"
    OR "Transaction"."description" LIKE 'Ajuste cierre ' || printf('%02d', "MonthlyClose"."month") || '/' || "MonthlyClose"."year" || ':%'
  LIMIT 1
)
WHERE
  "Transaction"."type" IN ('balance_adjustment', 'savings_allocation', 'savings_withdrawal')
  AND "Transaction"."description" IS NOT NULL;

-- CreateIndex
CREATE INDEX "Transaction_monthlyCloseId_idx" ON "Transaction"("monthlyCloseId");

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
