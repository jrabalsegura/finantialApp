-- CreateTable
CREATE TABLE "QuickTransactionTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "defaultAmount" DECIMAL,
    "accountId" TEXT,
    "destinationAccountId" TEXT,
    "categoryId" TEXT,
    "savingsBucketId" TEXT,
    "defaultDescription" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuickTransactionTemplate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuickTransactionTemplate_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuickTransactionTemplate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "QuickTransactionTemplate_savingsBucketId_fkey" FOREIGN KEY ("savingsBucketId") REFERENCES "SavingsBucket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "QuickTransactionTemplate_isActive_isFavorite_sortOrder_idx" ON "QuickTransactionTemplate"("isActive", "isFavorite", "sortOrder");
