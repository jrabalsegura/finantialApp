import {
  calculateNetWorthVariation,
  toMoneyNumber,
  type MoneyValue
} from "./financial-calculations";

export const UNCATEGORIZED_CATEGORY_ID = "sin-categoria";

export type CategoryTotal = {
  categoryId: string;
  count: number;
  name: string;
  value: number;
};

export type CategoryTransaction = {
  amount: MoneyValue;
  category: { id: string; name: string } | null;
  categoryId: string | null;
  date: Date | string;
  affectsPersonalExpense: boolean;
  affectsPersonalIncome: boolean;
};

export type DashboardNetWorthVariation = {
  amount: number;
  label: string;
};

export function calculateCategoryTotals({
  month,
  transactions,
  type,
  year
}: {
  month: number;
  transactions: CategoryTransaction[];
  type: "expense" | "income";
  year: number;
}): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();

  for (const transaction of transactions) {
    const date = new Date(transaction.date);
    const isCurrentMonth =
      date.getFullYear() === year && date.getMonth() + 1 === month;
    const affectsRequestedType =
      type === "expense"
        ? transaction.affectsPersonalExpense
        : transaction.affectsPersonalIncome;

    if (!isCurrentMonth || !affectsRequestedType) {
      continue;
    }

    const categoryId =
      transaction.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
    const existing = totals.get(categoryId);
    const amount = toMoneyNumber(transaction.amount);

    if (existing) {
      existing.count += 1;
      existing.value += amount;
      continue;
    }

    totals.set(categoryId, {
      categoryId,
      count: 1,
      name: transaction.category?.name ?? "Sin categoría",
      value: amount
    });
  }

  return Array.from(totals.values()).sort(
    (left, right) => right.value - left.value
  );
}

export function calculateDashboardNetWorthVariation(
  monthlyCloses: Array<{
    month: number;
    netWorth: MoneyValue;
    year: number;
  }>
): DashboardNetWorthVariation | null {
  if (monthlyCloses.length < 2) {
    return null;
  }

  const [latestClose, previousClose] = monthlyCloses;
  const amount = calculateNetWorthVariation(
    latestClose.netWorth,
    previousClose.netWorth
  );

  if (amount === null) {
    return null;
  }

  return {
    amount,
    label: `${formatCloseMonth(previousClose)} → ${formatCloseMonth(latestClose)}`
  };
}

function formatCloseMonth(close: { month: number; year: number }): string {
  return `${String(close.month).padStart(2, "0")}/${close.year}`;
}
