import Link from "next/link";
import type { TransactionType } from "@prisma/client";
import {
  createQuickTransaction,
  deleteRecentTransaction,
  updateRecentTransaction
} from "./actions";
import { QuickTransactionForm } from "./components/QuickTransactionForm";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { WeeklyBudgetCard } from "./components/WeeklyBudgetCard";
import { SavingsGoalProgress } from "./components/SavingsGoalProgress";
import { ConfirmSubmitButton } from "./components/ConfirmSubmitButton";
import { RecentTransactionEditDetails } from "./components/RecentTransactionEditDetails";
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
import { getBucketGoalProgress } from "@/domain/savings-goals";
import { formatPlainAmount } from "@/domain/money";

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
    actualMonthlyExpense,
    monthlySavings,
    pendingReimbursements,
    assignedSavings,
    netWorthVariation,
    expenseCategories,
    incomeCategories,
    pendingRecurringOccurrences,
    pendingRecurringAmount,
    quickTemplateOptions,
    reimbursementOptions
  } = await getDashboardData(today);
  const goalBuckets = savingsBuckets
    .map((bucket) => ({
      ...bucket,
      currentAmountNumber: toMoneyNumber(bucket.currentAmount),
      targetAmountNumber:
        bucket.targetAmount == null ? null : toMoneyNumber(bucket.targetAmount)
    }))
    .filter((bucket) =>
      getBucketGoalProgress({
        currentAmount: bucket.currentAmountNumber,
        targetAmount: bucket.targetAmountNumber
      }).hasGoal
    )
    .sort((left, right) => {
      const leftPriority = left.priority ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = right.priority ?? Number.MAX_SAFE_INTEGER;

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftPercentage =
        getBucketGoalProgress({
          currentAmount: left.currentAmountNumber,
          targetAmount: left.targetAmountNumber
        }).percentage ?? Number.MAX_SAFE_INTEGER;
      const rightPercentage =
        getBucketGoalProgress({
          currentAmount: right.currentAmountNumber,
          targetAmount: right.targetAmountNumber
        }).percentage ?? Number.MAX_SAFE_INTEGER;

      if (leftPercentage !== rightPercentage) {
        return leftPercentage - rightPercentage;
      }

      return left.name.localeCompare(right.name, "es");
    });
  const dashboardGoalBuckets = goalBuckets.slice(0, 4);
  const manualSavingsBuckets = savingsBuckets.filter(
    (bucket) => !bucket.isLongTerm
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="grid gap-3">
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
                      className="grid min-w-0 gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
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
                      <p className="amount-text text-sm font-semibold text-ink sm:text-right">
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
                label="Patrimonio líquido"
                value={netWorth}
                helper="Cuentas patrimoniales y pendientes vivos"
              />
              <MetricCard
                label="Ingresos del mes"
                tone="positive"
                value={monthlyIncome}
                helper="Reales y fijos pendientes del mes"
              />
              <MetricCard
                label="Gastos del mes"
                tone="negative"
                value={monthlyExpense}
                helper="Reales y fijos pendientes del mes"
              />
            </div>

            <section className="grid gap-3 lg:grid-cols-2">
              <MetricCard
                label="Ahorro mensual"
                tone={monthlySavings >= 0 ? "positive" : "negative"}
                value={monthlySavings}
                helper="Ingresos menos gastos previstos del mes"
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
                label="Gastos reales del mes"
                tone="negative"
                value={actualMonthlyExpense}
                helper="Solo movimientos confirmados"
              />
            </section>

            <section className="rounded-lg border border-line bg-white shadow-sm">
              <div className="grid gap-3 border-b border-line px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                <div>
                  <h2 className="text-lg font-semibold text-ink">
                    Objetivos de ahorro
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {goalBuckets.length} partidas con objetivo configurado
                  </p>
                </div>
                <Link className="nav-link" href="/savings">
                  Ver todas las partidas
                </Link>
              </div>
              {dashboardGoalBuckets.length > 0 ? (
                <ul className="divide-y divide-line">
                  {dashboardGoalBuckets.map((bucket) => (
                    <li key={bucket.id}>
                      <SavingsGoalProgress
                        bucket={{
                          currentAmount: bucket.currentAmountNumber,
                          name: bucket.name,
                          targetAmount: bucket.targetAmountNumber
                        }}
                        className="px-4 py-4 sm:px-5"
                        compact
                        href={`/savings/${bucket.id}`}
                        showName
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-8 text-sm text-muted sm:px-5">
                  Todavía no hay objetivos configurados en las partidas.
                </div>
              )}
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
              <SavingsBucketsGoalPanel
                buckets={savingsBuckets.map((bucket) => ({
                  currentAmount: toMoneyNumber(bucket.currentAmount),
                  href: `/savings/${bucket.id}`,
                  id: bucket.id,
                  name: bucket.name,
                  targetAmount:
                    bucket.targetAmount == null
                      ? null
                      : toMoneyNumber(bucket.targetAmount)
                }))}
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
                savingsBuckets={manualSavingsBuckets.map(({ id, name }) => ({
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
                const editBlockReason =
                  getRecentTransactionEditBlockReason(transaction);
                const deleteBlockReason =
                  getRecentTransactionDeleteBlockReason(transaction);
                const manageBlockReason = editBlockReason ?? deleteBlockReason;
                const isConfirmedRecurring = Boolean(
                  transaction.recurringOccurrence
                );

                return (
                  <li
                    className="grid min-w-0 gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5"
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

                    <div className="grid gap-2 justify-items-end">
                      <div className="flex items-center gap-2">
                        <p
                          className={`amount-text text-lg font-semibold sm:text-right ${
                            isOutflow
                              ? "text-rose-700"
                              : isInflow
                                ? "text-emerald-700"
                                : "text-ink"
                          }`}
                        >
                          {formatMovementAmount(transaction.type, amount)}
                        </p>
                        {editBlockReason ? null : (
                          <RecentTransactionEditDetails
                            summary={
                              <summary
                                className="icon-action cursor-pointer list-none text-accent hover:border-emerald-200 hover:bg-emerald-50 [&::-webkit-details-marker]:hidden"
                                title="Editar movimiento"
                              >
                                <PencilIcon />
                                <span className="sr-only">Editar movimiento</span>
                              </summary>
                            }
                          >
                            <div className="absolute right-0 top-full z-20 mt-2 grid w-[min(46rem,calc(100vw-3rem))] gap-3 rounded-lg border border-line bg-surface p-3 text-left shadow-sm">
                              <form
                                action={updateRecentTransaction}
                                className="grid gap-3 lg:grid-cols-4"
                              >
                              <input name="id" type="hidden" value={transaction.id} />
                              {isConfirmedRecurring ? (
                                <input
                                  name="type"
                                  type="hidden"
                                  value={transaction.type}
                                />
                              ) : null}
                              <label className="field-label">
                                Tipo
                                <select
                                  className="field-input"
                                  defaultValue={transaction.type}
                                  disabled={isConfirmedRecurring}
                                  name="type"
                                >
                                  <option value="expense">Gasto</option>
                                  <option value="income">Ingreso</option>
                                  <option value="transfer">Transferencia</option>
                                  <option value="savings_allocation">
                                    Asignación a ahorro
                                  </option>
                                </select>
                              </label>
                              <label className="field-label">
                                Importe
                                <input
                                  className="field-input"
                                  defaultValue={formatPlainAmount(amount)}
                                  inputMode="decimal"
                                  min="0.01"
                                  name="amount"
                                  required
                                  step="0.01"
                                  type="number"
                                />
                              </label>
                              <label className="field-label">
                                Fecha
                                <input
                                  className="field-input"
                                  defaultValue={formatDateInputValue(transaction.date)}
                                  name="date"
                                  required
                                  type="date"
                                />
                              </label>
                              <label className="field-label">
                                Cuenta
                                <select
                                  className="field-input"
                                  defaultValue={transaction.account.id}
                                  name="accountId"
                                  required
                                >
                                  {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field-label">
                                Destino
                                <select
                                  className="field-input"
                                  defaultValue={transaction.destinationAccount?.id ?? ""}
                                  name="destinationAccountId"
                                >
                                  <option value="">Sin destino</option>
                                  {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                      {account.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field-label">
                                Categoría
                                <select
                                  className="field-input"
                                  defaultValue={transaction.category?.id ?? ""}
                                  name="categoryId"
                                >
                                  <option value="">Sin categoría</option>
                                  {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field-label">
                                Partida
                                <select
                                  className="field-input"
                                  defaultValue={transaction.savingsBucketId ?? ""}
                                  name="savingsBucketId"
                                >
                                  <option value="">Sin partida</option>
                                  {manualSavingsBuckets.map((bucket) => (
                                    <option key={bucket.id} value={bucket.id}>
                                      {bucket.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="field-label">
                                Descripción
                                <input
                                  className="field-input"
                                  defaultValue={transaction.description ?? ""}
                                  name="description"
                                  type="text"
                                />
                              </label>
                              <button className="primary-button lg:col-span-2" type="submit">
                                Guardar cambios
                              </button>
                              </form>
                            </div>
                          </RecentTransactionEditDetails>
                        )}
                        {deleteBlockReason ? null : (
                          <form action={deleteRecentTransaction}>
                            <input name="id" type="hidden" value={transaction.id} />
                            <ConfirmSubmitButton
                              className="icon-action text-rose-700 hover:border-rose-200 hover:bg-rose-50"
                              confirmMessage="¿Eliminar este movimiento y revertir su efecto?"
                              title="Eliminar movimiento"
                            >
                              <TrashIcon />
                              <span className="sr-only">Eliminar movimiento</span>
                            </ConfirmSubmitButton>
                          </form>
                        )}
                      </div>
                      {manageBlockReason ? (
                        <p className="text-xs font-medium text-muted">
                          {manageBlockReason}
                        </p>
                      ) : null}
                    </div>
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

function SavingsBucketsGoalPanel({
  buckets
}: {
  buckets: Array<{
    currentAmount: number;
    href: string;
    id: string;
    name: string;
    targetAmount: number | null;
  }>;
}) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-ink">
          Progreso por partidas de ahorro
        </h2>
      </div>
      {buckets.length > 0 ? (
        <ul className="divide-y divide-line">
          {buckets.map((bucket) => (
            <li key={bucket.id}>
              <SavingsGoalProgress
                bucket={{
                  currentAmount: bucket.currentAmount,
                  name: bucket.name,
                  targetAmount: bucket.targetAmount
                }}
                className="px-4 py-4 sm:px-5"
                compact
                href={bucket.href}
                showName
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-sm text-muted sm:px-5">
          No hay partidas de ahorro.
        </div>
      )}
    </section>
  );
}

function getRecentTransactionEditBlockReason(transaction: {
  monthlyCloseId: string | null;
  originalReimbursement: { id: string } | null;
  recurringOccurrence: { id: string } | null;
  reimbursementId: string | null;
  type: TransactionType;
}): string | null {
  if (transaction.monthlyCloseId) {
    return "Incluido en un cierre mensual; no se edita desde recientes.";
  }

  if (transaction.originalReimbursement || transaction.reimbursementId) {
    return "Movimiento de reembolso; gestiónalo desde Pendientes de cobrar.";
  }

  if (
    transaction.type !== "expense" &&
    transaction.type !== "income" &&
    transaction.type !== "transfer" &&
    transaction.type !== "savings_allocation"
  ) {
    return "Este tipo de movimiento no se edita desde recientes.";
  }

  return null;
}

function getRecentTransactionDeleteBlockReason(transaction: {
  monthlyCloseId: string | null;
  originalReimbursement: { id: string } | null;
  recurringOccurrence: { id: string } | null;
  reimbursementId: string | null;
  type: TransactionType;
}): string | null {
  const editBlockReason = getRecentTransactionEditBlockReason(transaction);

  if (editBlockReason) {
    return editBlockReason;
  }

  return null;
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

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
