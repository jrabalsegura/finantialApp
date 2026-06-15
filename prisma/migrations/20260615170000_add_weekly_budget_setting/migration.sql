-- CreateTable
CREATE TABLE "BudgetSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "monthlyMinimumSavingsTarget" DECIMAL NOT NULL DEFAULT 300,
    "savingsBucketId" TEXT,
    "calculationMode" TEXT NOT NULL DEFAULT 'remaining_days',
    "includeReimbursableExpenses" BOOLEAN NOT NULL DEFAULT false,
    "includePendingTransactions" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BudgetSetting_savingsBucketId_fkey" FOREIGN KEY ("savingsBucketId") REFERENCES "SavingsBucket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "BudgetSetting" (
    "id",
    "monthlyMinimumSavingsTarget",
    "calculationMode",
    "includeReimbursableExpenses",
    "includePendingTransactions",
    "updatedAt"
) VALUES (
    'default',
    300,
    'remaining_days',
    false,
    false,
    CURRENT_TIMESTAMP
);
