-- CreateTable
CREATE TABLE "Account" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "currentBalance" DECIMAL NOT NULL DEFAULT 0,
  "includeInAvailableMoney" BOOLEAN NOT NULL DEFAULT true,
  "includeInNetWorth" BOOLEAN NOT NULL DEFAULT true,
  "includeInMonthlySavings" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "icon" TEXT,
  "color" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavingsBucket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "currentAmount" DECIMAL NOT NULL DEFAULT 0,
  "targetAmount" DECIMAL,
  "targetDate" DATETIME,
  "priority" INTEGER,
  "isLongTerm" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "amount" DECIMAL NOT NULL,
  "type" TEXT NOT NULL,
  "description" TEXT,
  "accountId" TEXT NOT NULL,
  "destinationAccountId" TEXT,
  "categoryId" TEXT,
  "savingsBucketId" TEXT,
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
  CONSTRAINT "Transaction_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reimbursement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "personName" TEXT NOT NULL,
  "originalTransactionId" TEXT NOT NULL,
  "expectedAmount" DECIMAL NOT NULL,
  "paidAmount" DECIMAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "dueDate" DATETIME,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Reimbursement_originalTransactionId_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "Transaction" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyClose" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "totalIncome" DECIMAL NOT NULL DEFAULT 0,
  "totalExpense" DECIMAL NOT NULL DEFAULT 0,
  "monthlySavings" DECIMAL NOT NULL DEFAULT 0,
  "availableMoney" DECIMAL NOT NULL DEFAULT 0,
  "netWorth" DECIMAL NOT NULL DEFAULT 0,
  "longTermAssets" DECIMAL NOT NULL DEFAULT 0,
  "notes" TEXT,
  "closedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MonthlyAccountSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "monthlyCloseId" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "calculatedBalance" DECIMAL NOT NULL,
  "realBalance" DECIMAL NOT NULL,
  "difference" DECIMAL NOT NULL,
  "adjustmentTransactionId" TEXT,
  CONSTRAINT "MonthlyAccountSnapshot_monthlyCloseId_fkey" FOREIGN KEY ("monthlyCloseId") REFERENCES "MonthlyClose" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MonthlyAccountSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MonthlyAccountSnapshot_adjustmentTransactionId_fkey" FOREIGN KEY ("adjustmentTransactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonthlyBucketSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "monthlyCloseId" TEXT NOT NULL,
  "savingsBucketId" TEXT NOT NULL,
  "amount" DECIMAL NOT NULL,
  CONSTRAINT "MonthlyBucketSnapshot_monthlyCloseId_fkey" FOREIGN KEY ("monthlyCloseId") REFERENCES "MonthlyClose" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MonthlyBucketSnapshot_savingsBucketId_fkey" FOREIGN KEY ("savingsBucketId") REFERENCES "SavingsBucket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SavingsBucket_name_key" ON "SavingsBucket"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Reimbursement_originalTransactionId_key" ON "Reimbursement"("originalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyClose_year_month_key" ON "MonthlyClose"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyAccountSnapshot_monthlyCloseId_accountId_key" ON "MonthlyAccountSnapshot"("monthlyCloseId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBucketSnapshot_monthlyCloseId_savingsBucketId_key" ON "MonthlyBucketSnapshot"("monthlyCloseId", "savingsBucketId");
