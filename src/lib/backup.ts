import type { Prisma } from "@prisma/client";
import packageJson from "../../package.json";
import {
  BACKUP_APP_NAME,
  BACKUP_SCHEMA_VERSION,
  type FinancialBackup,
  validateBackup
} from "@/domain/backup";
import { prisma } from "./prisma";

export async function exportBackup(): Promise<FinancialBackup> {
  const [
    accounts,
    categories,
    savingsBuckets,
    transactions,
    reimbursements,
    monthlyCloses,
    monthlyAccountSnapshots,
    monthlyBucketSnapshots,
    recurringTransactions,
    recurringTransactionOccurrences,
    quickTransactionTemplates,
    budgetSettings
  ] = await prisma.$transaction([
    prisma.account.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.category.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.savingsBucket.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.transaction.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.reimbursement.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.monthlyClose.findMany({
      orderBy: [{ year: "asc" }, { month: "asc" }]
    }),
    prisma.monthlyAccountSnapshot.findMany({ orderBy: { id: "asc" } }),
    prisma.monthlyBucketSnapshot.findMany({ orderBy: { id: "asc" } }),
    prisma.recurringTransaction.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.recurringTransactionOccurrence.findMany({
      orderBy: { createdAt: "asc" }
    }),
    prisma.quickTransactionTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
    }),
    prisma.budgetSetting.findMany({ orderBy: { createdAt: "asc" } })
  ]);

  return {
    metadata: {
      appName: BACKUP_APP_NAME,
      appVersion: packageJson.version,
      exportedAt: new Date().toISOString(),
      schemaVersion: BACKUP_SCHEMA_VERSION
    },
    data: {
      accounts: accounts.map((record) => ({
        ...record,
        currentBalance: record.currentBalance.toString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      categories: categories.map(serializeTimestamps),
      savingsBuckets: savingsBuckets.map((record) => ({
        ...record,
        currentAmount: record.currentAmount.toString(),
        targetAmount: record.targetAmount?.toString() ?? null,
        targetDate: record.targetDate?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      transactions: transactions.map((record) => ({
        ...record,
        date: record.date.toISOString(),
        amount: record.amount.toString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      reimbursements: reimbursements.map((record) => ({
        ...record,
        expectedAmount: record.expectedAmount.toString(),
        paidAmount: record.paidAmount.toString(),
        dueDate: record.dueDate?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      monthlyCloses: monthlyCloses.map((record) => ({
        ...record,
        totalIncome: record.totalIncome.toString(),
        totalExpense: record.totalExpense.toString(),
        monthlySavings: record.monthlySavings.toString(),
        availableMoney: record.availableMoney.toString(),
        netWorth: record.netWorth.toString(),
        longTermAssets: record.longTermAssets.toString(),
        closedAt: record.closedAt?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      monthlyAccountSnapshots: monthlyAccountSnapshots.map((record) => ({
        ...record,
        calculatedBalance: record.calculatedBalance.toString(),
        realBalance: record.realBalance.toString(),
        difference: record.difference.toString()
      })),
      monthlyBucketSnapshots: monthlyBucketSnapshots.map((record) => ({
        ...record,
        amount: record.amount.toString()
      })),
      recurringTransactions: recurringTransactions.map((record) => ({
        ...record,
        amount: record.amount.toString(),
        startDate: record.startDate.toISOString(),
        endDate: record.endDate?.toISOString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      recurringTransactionOccurrences:
        recurringTransactionOccurrences.map((record) => ({
          ...record,
          scheduledDate: record.scheduledDate.toISOString(),
          amount: record.amount.toString(),
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        })),
      quickTransactionTemplates: quickTransactionTemplates.map((record) => ({
        ...record,
        defaultAmount: record.defaultAmount?.toString() ?? null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      })),
      budgetSettings: budgetSettings.map((record) => ({
        ...record,
        monthlyMinimumSavingsTarget:
          record.monthlyMinimumSavingsTarget.toString(),
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString()
      }))
    }
  };
}

export async function importBackup(input: unknown): Promise<void> {
  const validation = validateBackup(input);

  if (!validation.success) {
    throw new Error(validation.errors[0] ?? "La copia de seguridad no es válida.");
  }

  const { data } = validation.data;

  await prisma.$transaction(
    async (tx) => {
      await clearCurrentData(tx);

      await tx.account.createMany({
        data: data.accounts.map((record) => ({
          ...record,
          currentBalance: record.currentBalance,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.category.createMany({
        data: data.categories.map((record) => ({
          ...record,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.savingsBucket.createMany({
        data: data.savingsBuckets.map((record) => ({
          ...record,
          currentAmount: record.currentAmount,
          targetAmount: record.targetAmount,
          targetDate: toOptionalDate(record.targetDate),
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.budgetSetting.createMany({
        data: data.budgetSettings.map((record) => ({
          ...record,
          monthlyMinimumSavingsTarget:
            record.monthlyMinimumSavingsTarget,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.transaction.createMany({
        data: data.transactions.map(({
          monthlyCloseId: _ignoredClose,
          reimbursementId: _ignored,
          ...record
        }) => ({
          ...record,
          monthlyCloseId: null,
          reimbursementId: null,
          date: new Date(record.date),
          amount: record.amount,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.reimbursement.createMany({
        data: data.reimbursements.map((record) => ({
          ...record,
          expectedAmount: record.expectedAmount,
          paidAmount: record.paidAmount,
          dueDate: toOptionalDate(record.dueDate),
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });

      for (const transaction of data.transactions) {
        if (transaction.reimbursementId) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              reimbursementId: transaction.reimbursementId,
              updatedAt: new Date(transaction.updatedAt)
            }
          });
        }
      }

      await tx.recurringTransaction.createMany({
        data: data.recurringTransactions.map((record) => ({
          ...record,
          amount: record.amount,
          startDate: new Date(record.startDate),
          endDate: toOptionalDate(record.endDate),
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.recurringTransactionOccurrence.createMany({
        data: data.recurringTransactionOccurrences.map((record) => ({
          ...record,
          scheduledDate: new Date(record.scheduledDate),
          amount: record.amount,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.quickTransactionTemplate.createMany({
        data: data.quickTransactionTemplates.map((record) => ({
          ...record,
          defaultAmount: record.defaultAmount,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });
      await tx.monthlyClose.createMany({
        data: data.monthlyCloses.map((record) => ({
          ...record,
          totalIncome: record.totalIncome,
          totalExpense: record.totalExpense,
          monthlySavings: record.monthlySavings,
          availableMoney: record.availableMoney,
          netWorth: record.netWorth,
          longTermAssets: record.longTermAssets,
          closedAt: toOptionalDate(record.closedAt),
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt)
        }))
      });

      for (const transaction of data.transactions) {
        if (transaction.monthlyCloseId) {
          await tx.transaction.update({
            where: { id: transaction.id },
            data: {
              monthlyCloseId: transaction.monthlyCloseId,
              updatedAt: new Date(transaction.updatedAt)
            }
          });
        }
      }

      await tx.monthlyAccountSnapshot.createMany({
        data: data.monthlyAccountSnapshots
      });
      await tx.monthlyBucketSnapshot.createMany({
        data: data.monthlyBucketSnapshots
      });
    },
    {
      maxWait: 10_000,
      timeout: 60_000
    }
  );
}

async function clearCurrentData(tx: Prisma.TransactionClient): Promise<void> {
  await tx.budgetSetting.deleteMany();
  await tx.quickTransactionTemplate.deleteMany();
  await tx.recurringTransactionOccurrence.deleteMany();
  await tx.monthlyAccountSnapshot.deleteMany();
  await tx.monthlyBucketSnapshot.deleteMany();
  await tx.recurringTransaction.deleteMany();
  await tx.reimbursement.deleteMany();
  await tx.transaction.deleteMany();
  await tx.monthlyClose.deleteMany();
  await tx.account.deleteMany();
  await tx.category.deleteMany();
  await tx.savingsBucket.deleteMany();
}

function serializeTimestamps<T extends { createdAt: Date; updatedAt: Date }>(
  record: T
): Omit<T, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
} {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toOptionalDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
