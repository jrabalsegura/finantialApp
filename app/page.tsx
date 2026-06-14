import Link from "next/link";
import { createQuickTransaction } from "./actions";
import { QuickTransactionForm } from "./components/QuickTransactionForm";
import { prisma } from "@/lib/prisma";
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
import type { MoneyValue } from "@/domain/financial-calculations";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric"
});

const transactionLabels = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
  balance_adjustment: "Ajuste",
  reimbursable_expense: "Reembolsable",
  reimbursement_income: "Cobro reembolso",
  investment_gain: "Revalorización",
  investment_loss: "Pérdida inversión",
  savings_allocation: "Asignación ahorro",
  savings_withdrawal: "Retirada ahorro"
};

const uncategorizedCategoryId = "sin-categoria";

export default async function Home() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentMonthRange = getMonthDateRange(currentYear, currentMonth);

  const [
    accounts,
    categories,
    recentTransactions,
    monthlyTransactions,
    reimbursements,
    savingsBuckets,
    monthlyCloses
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
    })
  ]);

  const defaultAccount =
    accounts.find((account) => account.name === "Openbank principal") ??
    accounts.find((account) => account.isDefault) ??
    accounts[0];
  const availableMoney = calculateAvailableMoney(accounts);
  const netWorth = calculateNetWorth(accounts, reimbursements);
  const monthlyIncome = calculateRealMonthlyIncome(
    monthlyTransactions,
    currentYear,
    currentMonth
  );
  const monthlyExpense = calculateRealMonthlyExpense(
    monthlyTransactions,
    currentYear,
    currentMonth
  );
  const monthlySavings = calculateRealMonthlySavings(
    monthlyTransactions,
    currentYear,
    currentMonth
  );
  const pendingReimbursements = calculatePendingReimbursements(reimbursements);
  const assignedSavings = calculateAssignedSavings(savingsBuckets);
  const unassignedMoney = calculateUnassignedAvailableMoney(
    accounts,
    savingsBuckets
  );
  const netWorthVariation = calculateNetWorthVariation(monthlyCloses);
  const expenseCategories = calculateCategoryTotals({
    month: currentMonth,
    transactions: monthlyTransactions,
    type: "expense",
    year: currentYear
  });
  const incomeCategories = calculateCategoryTotals({
    month: currentMonth,
    transactions: monthlyTransactions,
    type: "income",
    year: currentYear
  });

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Finanzas personales
            </h1>
            <p className="text-sm text-muted">
              {capitalize(monthFormatter.format(today))}
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/accounts">
              Cuentas
            </Link>
            <Link className="nav-link" href="/savings">
              Partidas
            </Link>
            <Link className="nav-link" href="/reimbursements">
              Pendientes
            </Link>
            <Link className="nav-link" href="/monthly-close">
              Cierre
            </Link>
          </nav>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <section className="order-2 grid gap-6 lg:order-1">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Dinero disponible"
                value={availableMoney}
                helper="Cuentas marcadas como disponibles"
              />
              <MetricCard
                label="Patrimonio total"
                value={netWorth}
                helper="Cuentas patrimoniales y pendientes vivos"
              />
              <MetricCard
                label="Ingresos del mes"
                tone="positive"
                value={monthlyIncome}
                helper="Solo ingresos personales reales"
              />
              <MetricCard
                label="Gastos del mes"
                tone="negative"
                value={monthlyExpense}
                helper="Solo gastos personales reales"
              />
            </div>

            <section className="grid gap-3 lg:grid-cols-2">
              <MetricCard
                label="Ahorro mensual"
                tone={monthlySavings >= 0 ? "positive" : "negative"}
                value={monthlySavings}
                helper="Ingresos reales menos gastos reales del mes"
              />
              <NetWorthVariationCard variation={netWorthVariation} />
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Pendientes de cobrar"
                value={pendingReimbursements.totalPending}
                helper={`${pendingReimbursements.count} pendientes abiertos`}
              />
              <MetricCard
                label="Dinero asignado"
                value={assignedSavings}
                helper="Total reservado en partidas"
              />
              <MetricCard
                label="Dinero no asignado"
                value={unassignedMoney}
                helper="Disponible menos partidas asignadas"
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <CategoryBreakdownPanel
                emptyText="No hay gastos personales este mes."
                items={expenseCategories}
                month={currentMonth}
                tone="expense"
                title="Gastos del mes por categoría"
                year={currentYear}
              />
              <CategoryBreakdownPanel
                emptyText="No hay ingresos personales este mes."
                items={incomeCategories}
                month={currentMonth}
                tone="income"
                title="Ingresos del mes por categoría"
                year={currentYear}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <DistributionPanel
                emptyText="No hay cuentas."
                items={accounts.map((account) => ({
                  href: `/accounts/${account.id}`,
                  id: account.id,
                  label: account.name,
                  value: toMoneyNumber(account.currentBalance),
                  detail: [
                    account.includeInAvailableMoney ? "Disponible" : null,
                    account.includeInNetWorth ? "Patrimonio" : null
                  ]
                    .filter(Boolean)
                    .join(" · ")
                }))}
                title="Distribución por cuentas"
              />
              <DistributionPanel
                emptyText="No hay partidas de ahorro."
                items={savingsBuckets.map((bucket) => ({
                  href: `/savings/${bucket.id}`,
                  id: bucket.id,
                  label: bucket.name,
                  value: toMoneyNumber(bucket.currentAmount),
                  detail: bucket.isLongTerm ? "Largo plazo" : "Corto/medio plazo"
                }))}
                title="Distribución por partidas de ahorro"
              />
            </section>
          </section>

          <aside className="order-1 grid gap-6 lg:order-2">
            {accounts.length > 0 ? (
              <QuickTransactionForm
                accounts={accounts.map(({ id, name }) => ({ id, name }))}
                action={createQuickTransaction}
                categories={categories}
                defaultAccountId={defaultAccount.id}
                today={getTodayInputValue()}
              />
            ) : (
              <section className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
                Ejecuta el seed inicial para crear las cuentas y categorías base.
              </section>
            )}
          </aside>
        </div>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Movimientos recientes
            </h2>
          </div>

          {recentTransactions.length > 0 ? (
            <ul className="divide-y divide-line">
              {recentTransactions.map((transaction) => {
                const isOutflow =
                  transaction.type === "expense" ||
                  transaction.type === "reimbursable_expense";
                const isInflow =
                  transaction.type === "income" ||
                  transaction.type === "reimbursement_income";
                const amount = toMoneyNumber(transaction.amount);

                return (
                  <li
                    className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                    key={transaction.id}
                  >
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {transaction.description ||
                            transaction.category?.name ||
                            transactionLabels[transaction.type]}
                        </span>
                        <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                          {transactionLabels[transaction.type]}
                        </span>
                      </div>
                      <p className="text-sm text-muted">
                        {formatMovementRoute(transaction)} ·{" "}
                        {dateFormatter.format(transaction.date)}
                      </p>
                    </div>

                    <p
                      className={`text-lg font-semibold ${
                        isOutflow
                          ? "text-rose-700"
                          : isInflow
                            ? "text-emerald-700"
                            : "text-ink"
                      }`}
                    >
                      {formatMovementAmount(transaction.type, amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay movimientos registrados.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  helper,
  label,
  tone,
  value
}: {
  helper: string;
  label: string;
  tone?: "positive" | "negative";
  value: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "positive"
            ? "text-emerald-700"
            : tone === "negative"
              ? "text-rose-700"
              : "text-ink"
        }`}
      >
        {currencyFormatter.format(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
    </div>
  );
}

function NetWorthVariationCard({
  variation
}: {
  variation:
    | {
        amount: number;
        label: string;
      }
    | null;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">Variación patrimonial</p>
      {variation ? (
        <>
          <p
            className={`mt-2 text-2xl font-semibold ${
              variation.amount >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {currencyFormatter.format(variation.amount)}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            {variation.label}. Incluye ahorro, aportaciones, revalorizaciones y
            pérdidas.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold text-ink">Sin cierres</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Se calculará cuando existan al menos dos cierres mensuales. Es una
            métrica separada del ahorro mensual.
          </p>
        </>
      )}
    </div>
  );
}

function DistributionPanel({
  emptyText,
  items,
  title
}: {
  emptyText: string;
  items: Array<{
    detail: string;
    href?: string;
    id: string;
    label: string;
    value: number;
  }>;
  title: string;
}) {
  const positiveTotal = items.reduce(
    (total, item) => total + Math.max(item.value, 0),
    0
  );

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const percentage =
              positiveTotal > 0 ? Math.max(item.value, 0) / positiveTotal : 0;

            return (
              <li key={item.id}>
                <DistributionPanelItem item={item} percentage={percentage} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-8 text-sm text-muted sm:px-5">{emptyText}</div>
      )}
    </section>
  );
}

function DistributionPanelItem({
  item,
  percentage
}: {
  item: {
    detail: string;
    href?: string;
    label: string;
    value: number;
  };
  percentage: number;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{item.label}</p>
          <p className="text-xs text-muted">{item.detail || "-"}</p>
        </div>
        <p className="text-sm font-semibold text-ink">
          {currencyFormatter.format(item.value)}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.round(percentage * 100)}%` }}
        />
      </div>
    </>
  );

  if (item.href) {
    return (
      <Link
        className="grid gap-2 px-4 py-4 transition hover:bg-surface sm:px-5"
        href={item.href}
      >
        {content}
      </Link>
    );
  }

  return <div className="grid gap-2 px-4 py-4 sm:px-5">{content}</div>;
}

function CategoryBreakdownPanel({
  emptyText,
  items,
  month,
  title,
  tone,
  year
}: {
  emptyText: string;
  items: CategoryTotal[];
  month: number;
  title: string;
  tone: "expense" | "income";
  year: number;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const barColor = tone === "income" ? "bg-emerald-600" : "bg-rose-600";
  const amountColor = tone === "income" ? "text-emerald-700" : "text-rose-700";

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const percentage = total > 0 ? item.value / total : 0;

            return (
              <li key={item.categoryId}>
                <Link
                  className="grid gap-2 px-4 py-4 transition hover:bg-surface sm:px-5"
                  href={buildCategoryDetailHref({
                    categoryId: item.categoryId,
                    month,
                    type: tone,
                    year
                  })}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted">
                        {item.count} {item.count === 1 ? "movimiento" : "movimientos"}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${amountColor}`}>
                      {currencyFormatter.format(item.value)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.round(percentage * 100)}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-8 text-sm text-muted sm:px-5">{emptyText}</div>
      )}
    </section>
  );
}

type CategoryTotal = {
  categoryId: string;
  count: number;
  name: string;
  value: number;
};

function calculateCategoryTotals({
  month,
  transactions,
  type,
  year
}: {
  month: number;
  transactions: Array<{
    amount: MoneyValue;
    category: { id: string; name: string } | null;
    categoryId: string | null;
    date: Date | string;
    affectsPersonalExpense: boolean;
    affectsPersonalIncome: boolean;
  }>;
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

    const categoryId = transaction.categoryId ?? uncategorizedCategoryId;
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

  return Array.from(totals.values()).sort((left, right) => right.value - left.value);
}

function calculateNetWorthVariation(
  monthlyCloses: Array<{
    month: number;
    netWorth: MoneyValue;
    year: number;
  }>
):
  | {
      amount: number;
      label: string;
    }
  | null {
  if (monthlyCloses.length < 2) {
    return null;
  }

  const [latestClose, previousClose] = monthlyCloses;
  const amount =
    toMoneyNumber(latestClose.netWorth) -
    toMoneyNumber(previousClose.netWorth);

  return {
    amount,
    label: `${formatCloseMonth(previousClose)} → ${formatCloseMonth(latestClose)}`
  };
}

function buildCategoryDetailHref({
  categoryId,
  month,
  type,
  year
}: {
  categoryId: string;
  month: number;
  type: "expense" | "income";
  year: number;
}): string {
  const params = new URLSearchParams({
    month: String(month),
    type,
    year: String(year)
  });

  return `/categories/${encodeURIComponent(categoryId)}?${params.toString()}`;
}

function getTodayInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatCloseMonth(close: { month: number; year: number }): string {
  return `${String(close.month).padStart(2, "0")}/${close.year}`;
}

function formatMovementRoute(transaction: {
  account: { name: string };
  destinationAccount: { name: string } | null;
  category: { name: string } | null;
  type: keyof typeof transactionLabels;
}): string {
  if (transaction.type === "transfer" && transaction.destinationAccount) {
    return `${transaction.account.name} -> ${transaction.destinationAccount.name}`;
  }

  return [transaction.account.name, transaction.category?.name]
    .filter(Boolean)
    .join(" · ");
}

function formatMovementAmount(
  type: keyof typeof transactionLabels,
  amount: number
): string {
  if (type === "expense" || type === "reimbursable_expense") {
    return `-${currencyFormatter.format(amount)}`;
  }

  if (type === "income" || type === "reimbursement_income") {
    return `+${currencyFormatter.format(amount)}`;
  }

  return currencyFormatter.format(amount);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
