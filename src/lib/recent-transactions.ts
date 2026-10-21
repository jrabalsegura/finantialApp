import type { Prisma } from "@prisma/client";
import { getMonthDateRange } from "@/domain/financial-calculations";
import { prisma } from "./prisma";

const recentTransactionSelect = {
  id: true,
  accountId: true,
  affectsMonthlySavings: true,
  affectsNetWorth: true,
  affectsPersonalExpense: true,
  affectsPersonalIncome: true,
  affectsRealBalance: true,
  weeklyBudgetImpactScope: true,
  amount: true,
  categoryId: true,
  createdAt: true,
  date: true,
  description: true,
  destinationAccountId: true,
  monthlyCloseId: true,
  reimbursementId: true,
  savingsTransferId: true,
  savingsBucketId: true,
  type: true,
  account: {
    select: {
      id: true,
      includeInMonthlySavings: true,
      name: true
    }
  },
  destinationAccount: {
    select: {
      id: true,
      name: true
    }
  },
  category: {
    select: {
      id: true,
      name: true
    }
  },
  originalReimbursement: {
    select: { id: true }
  },
  recurringOccurrence: {
    select: { id: true }
  }
} satisfies Prisma.TransactionSelect;

export async function getRecentTransactionsData(
  referenceDate: Date = new Date()
) {
  const currentMonthRange = getMonthDateRange(
    referenceDate.getFullYear(),
    referenceDate.getMonth() + 1
  );

  const [
    accounts,
    categories,
    savingsBuckets,
    latestTransactions,
    currentMonthTransactions,
    latestClosedPeriod
  ] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true
      }
    }),
    prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true
      }
    }),
    prisma.savingsBucket.findMany({
      where: { isLongTerm: false },
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true
      }
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      select: recentTransactionSelect
    }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: currentMonthRange.start,
          lt: currentMonthRange.end
        }
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: recentTransactionSelect
    }),
    prisma.monthlyClose.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        year: true,
        month: true
      }
    })
  ]);

  const recentTransactions = mergeRecentTransactions(
    latestTransactions,
    currentMonthTransactions
  ).map((transaction) => ({
    ...transaction,
    isPeriodClosed:
      !!latestClosedPeriod &&
      transaction.date.getFullYear() * 12 + transaction.date.getMonth() <=
        latestClosedPeriod.year * 12 + latestClosedPeriod.month - 1
  }));

  return {
    accounts,
    categories,
    savingsBuckets,
    recentTransactions
  };
}

function mergeRecentTransactions<
  Transaction extends { createdAt: Date; date: Date; id: string }
>(...transactionGroups: Transaction[][]): Transaction[] {
  const transactionsById = new Map<string, Transaction>();

  for (const transactions of transactionGroups) {
    for (const transaction of transactions) {
      transactionsById.set(transaction.id, transaction);
    }
  }

  return Array.from(transactionsById.values()).sort((left, right) => {
    const dateDifference = right.date.getTime() - left.date.getTime();

    if (dateDifference !== 0) {
      return dateDifference;
    }

    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}
