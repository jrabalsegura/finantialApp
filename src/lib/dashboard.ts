import {
  calculateCategoryTotals,
  calculateDashboardNetWorthVariation
} from "@/domain/dashboard";
import {
  calculateAssignedSavings,
  calculateAvailableMoney,
  calculateNetWorth,
  calculatePendingReimbursements,
  calculateRealMonthlyExpense,
  calculateRealMonthlyIncome,
  calculateRealMonthlySavings,
  calculateUnassignedAvailableMoney,
  getMonthDateRange,
  toMoneyNumber
} from "@/domain/financial-calculations";
import { buildTransactionDraftFromTemplate } from "@/domain/quick-transaction-templates";
import { prisma } from "./prisma";
import { getQuickTemplates } from "./quick-transaction-templates";
import { generateRecurringOccurrencesForMonth } from "./recurring-transactions";
import { getWeeklyBudgetReport } from "./weekly-budget";

export async function getDashboardData(referenceDate: Date = new Date()) {
  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth() + 1;
  const currentMonthRange = getMonthDateRange(currentYear, currentMonth);

  await generateRecurringOccurrencesForMonth(currentYear, currentMonth);

  const [
    accounts,
    categories,
    recentTransactions,
    monthlyTransactions,
    reimbursements,
    savingsBuckets,
    monthlyCloses,
    recurringOccurrences,
    quickTemplates,
    weeklyBudgetReport
  ] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        currentBalance: true,
        includeInAvailableMoney: true,
        includeInNetWorth: true,
        isDefault: true
      }
    }),
    prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true
      }
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 12,
      include: {
        account: {
          select: {
            name: true
          }
        },
        destinationAccount: {
          select: {
            name: true
          }
        },
        category: {
          select: {
            name: true
          }
        }
      }
    }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: currentMonthRange.start,
          lt: currentMonthRange.end
        }
      },
      select: {
        category: {
          select: {
            id: true,
            name: true
          }
        },
        categoryId: true,
        date: true,
        amount: true,
        type: true,
        affectsPersonalExpense: true,
        affectsPersonalIncome: true,
        affectsMonthlySavings: true,
        affectsNetWorth: true
      }
    }),
    prisma.reimbursement.findMany({
      select: {
        id: true,
        title: true,
        personName: true,
        expectedAmount: true,
        paidAmount: true,
        status: true,
        dueDate: true
      }
    }),
    prisma.savingsBucket.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        currentAmount: true,
        isLongTerm: true,
        priority: true,
        targetAmount: true
      }
    }),
    prisma.monthlyClose.findMany({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      take: 2,
      select: {
        year: true,
        month: true,
        netWorth: true
      }
    }),
    prisma.recurringTransactionOccurrence.findMany({
      where: {
        year: currentYear,
        month: currentMonth
      },
      orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
      include: {
        recurringTransaction: {
          include: {
            account: {
              select: { name: true }
            },
            destinationAccount: {
              select: { name: true }
            },
            savingsBucket: {
              select: { name: true }
            }
          }
        }
      }
    }),
    getQuickTemplates({ activeOnly: true, favoritesOnly: true }),
    getWeeklyBudgetReport(referenceDate)
  ]);

  const defaultAccount =
    accounts.find((account) => account.name === "Openbank principal") ??
    accounts.find((account) => account.isDefault) ??
    accounts[0];
  const pendingRecurringOccurrences = recurringOccurrences.filter(
    (occurrence) => occurrence.status === "pending"
  );

  return {
    currentMonth,
    currentYear,
    accounts,
    categories,
    recentTransactions,
    reimbursements,
    savingsBuckets,
    weeklyBudgetReport,
    defaultAccountId: defaultAccount?.id ?? null,
    availableMoney: calculateAvailableMoney(accounts),
    netWorth: calculateNetWorth(accounts, reimbursements),
    monthlyIncome: calculateRealMonthlyIncome(
      monthlyTransactions,
      currentYear,
      currentMonth
    ),
    monthlyExpense: calculateRealMonthlyExpense(
      monthlyTransactions,
      currentYear,
      currentMonth
    ),
    monthlySavings: calculateRealMonthlySavings(
      monthlyTransactions,
      currentYear,
      currentMonth
    ),
    pendingReimbursements: calculatePendingReimbursements(reimbursements),
    assignedSavings: calculateAssignedSavings(savingsBuckets),
    unassignedMoney: calculateUnassignedAvailableMoney(
      accounts,
      savingsBuckets
    ),
    netWorthVariation:
      calculateDashboardNetWorthVariation(monthlyCloses),
    expenseCategories: calculateCategoryTotals({
      month: currentMonth,
      transactions: monthlyTransactions,
      type: "expense",
      year: currentYear
    }),
    incomeCategories: calculateCategoryTotals({
      month: currentMonth,
      transactions: monthlyTransactions,
      type: "income",
      year: currentYear
    }),
    pendingRecurringOccurrences,
    pendingRecurringAmount: pendingRecurringOccurrences.reduce(
      (total, occurrence) => total + toMoneyNumber(occurrence.amount),
      0
    ),
    quickTemplateOptions: defaultAccount
      ? quickTemplates.map((template) => ({
          id: template.id,
          name: template.name,
          icon: template.icon,
          color: template.color,
          draft: buildTransactionDraftFromTemplate(
            template,
            defaultAccount.id
          )
        }))
      : [],
    reimbursementOptions: reimbursements
      .filter(
        (reimbursement) =>
          reimbursement.status === "pending" ||
          reimbursement.status === "partially_paid"
      )
      .map((reimbursement) => ({
        id: reimbursement.id,
        title: reimbursement.title,
        personName: reimbursement.personName,
        pendingAmount:
          toMoneyNumber(reimbursement.expectedAmount) -
          toMoneyNumber(reimbursement.paidAmount)
      }))
  };
}
