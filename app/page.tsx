import Link from "next/link";
import type { TransactionType } from "@prisma/client";
import { createQuickTransaction } from "./actions";
import { QuickTransactionForm } from "./components/QuickTransactionForm";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { WeeklyBudgetCard } from "./components/WeeklyBudgetCard";
import {
  CategoryBreakdownPanel,
  DistributionPanel,
  MetricCard,
  NetWorthVariationCard
} from "./components/dashboard/DashboardPanels";
import { getDashboardData } from "@/lib/dashboard";
import { TRANSACTION_TYPE_LABELS } from "@/domain/domain-options";
import {
  currencyFormatter,
  formatDateInputValue,
  monthYearFormatter as monthFormatter,
  shortDateFormatter as dateFormatter
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

export default async function Home() {
  const today = new Date();
  const {
    currentMonth,
    currentYear,
    accounts,
    categories,
    recentTransactions,
    savingsBuckets,
    weeklyBudgetReport,
    defaultAccountId,
    availableMoney,
    netWorth,
    monthlyIncome,
    monthlyExpense,
    monthlySavings,
    pendingReimbursements,
    assignedSavings,
    unassignedMoney,
    netWorthVariation,
    expenseCategories,
    incomeCategories,
    pendingRecurringOccurrences,
    pendingRecurringAmount,
    quickTemplateOptions,
    reimbursementOptions
  } = await getDashboardData(today);

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
            <Link className="nav-link" href="/recurring">
              Fijos
            </Link>
            <Link className="nav-link" href="/quick-templates">
              Accesos rápidos
            </Link>
            <Link className="nav-link" href="/monthly-close">
              Cierre
            </Link>
            <Link className="nav-link" href="/history">
              Histórico
            </Link>
            <Link className="nav-link" href="/settings/budget">
              Configuración
            </Link>
          </nav>
        </header>

        <WeeklyBudgetCard status={weeklyBudgetReport.status} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <section className="order-2 grid gap-6 lg:order-1">
            <section className="rounded-lg border border-line bg-white shadow-sm">
              <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                <div>
                  <h2 className="text-lg font-semibold text-ink">
                    Movimientos fijos del mes
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {pendingRecurringOccurrences.length} pendientes por{" "}
                    {currencyFormatter.format(pendingRecurringAmount)}
                  </p>
                </div>
                <Link className="primary-button" href="/recurring">
                  Revisar pendientes
                </Link>
              </div>
              {pendingRecurringOccurrences.length > 0 ? (
                <ul className="divide-y divide-line">
                  {pendingRecurringOccurrences.slice(0, 3).map((occurrence) => (
                    <li
                      className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                      key={occurrence.id}
                    >
                      <div>
                        <p className="text-sm font-semibold text-ink">
                          {occurrence.recurringTransaction.name}
                        </p>
                        <p className="text-xs text-muted">
                          {occurrence.recurringTransaction.account.name}
                          {occurrence.recurringTransaction.destinationAccount
                            ? ` → ${occurrence.recurringTransaction.destinationAccount.name}`
                            : occurrence.recurringTransaction.savingsBucket
                              ? ` → ${occurrence.recurringTransaction.savingsBucket.name}`
                            : ""}
                          {" · "}
                          {dateFormatter.format(occurrence.scheduledDate)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        {currencyFormatter.format(
                          toMoneyNumber(occurrence.amount)
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-4 text-sm text-muted sm:px-5">
                  No tienes movimientos fijos pendientes este mes.
                </div>
              )}
            </section>

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
            {defaultAccountId ? (
              <QuickTransactionForm
                accounts={accounts.map(({ id, name }) => ({ id, name }))}
                action={createQuickTransaction}
                categories={categories}
                defaultAccountId={defaultAccountId}
                reimbursements={reimbursementOptions}
                savingsBuckets={savingsBuckets.map(({ id, name }) => ({
                  id,
                  name
                }))}
                templates={quickTemplateOptions}
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
                            TRANSACTION_TYPE_LABELS[transaction.type]}
                        </span>
                        <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                          {TRANSACTION_TYPE_LABELS[transaction.type]}
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

function getTodayInputValue(): string {
  return formatDateInputValue(new Date());
}

function formatMovementRoute(transaction: {
  account: { name: string };
  destinationAccount: { name: string } | null;
  category: { name: string } | null;
  type: TransactionType;
}): string {
  if (transaction.type === "transfer" && transaction.destinationAccount) {
    return `${transaction.account.name} -> ${transaction.destinationAccount.name}`;
  }

  return [transaction.account.name, transaction.category?.name]
    .filter(Boolean)
    .join(" · ");
}

function formatMovementAmount(
  type: TransactionType,
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
