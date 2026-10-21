import { requireCurrentUser } from "@/lib/auth";
import type { TransactionType, WeeklyBudgetImpactScope } from "@prisma/client";
import { deleteRecentTransaction, updateRecentTransaction } from "../actions";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import { RecentTransactionEditDetails } from "../components/RecentTransactionEditDetails";
import { getRecentTransactionsData } from "@/lib/recent-transactions";
import {
  getWeeklyBudgetImpactOptions,
  TRANSACTION_TYPE_LABELS,
  WEEKLY_BUDGET_IMPACT_SCOPE_BADGE_LABELS
} from "@/domain/domain-options";
import {
  currencyFormatter,
  formatDateInputValue,
  shortDateFormatter as dateFormatter
} from "@/lib/formatters";
import { formatPlainAmount } from "@/domain/money";

export const dynamic = "force-dynamic";

export default async function RecentTransactionsPage() {
  await requireCurrentUser();
  const {
    accounts,
    categories,
    savingsBuckets: manualSavingsBuckets,
    recentTransactions
  } = await getRecentTransactionsData();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="grid gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">
            Movimientos
          </p>
          <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
            Movimientos recientes
          </h1>
          <p className="text-sm text-muted">
            Los últimos movimientos y todos los del mes en curso.
          </p>
        </header>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              {recentTransactions.length} movimientos
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
                        {isConfirmedRecurring ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                            {getRecurringBudgetBadgeLabel(transaction.type)}
                          </span>
                        ) : getWeeklyBudgetImpactBadgeLabel(
                            transaction.weeklyBudgetImpactScope
                          ) ? (
                          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                            {getWeeklyBudgetImpactBadgeLabel(
                              transaction.weeklyBudgetImpactScope
                            )}
                          </span>
                        ) : null}
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
                              {isConfirmedRecurring ? (
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950 lg:col-span-4">
                                  <p className="font-semibold">
                                    {getRecurringBudgetBadgeLabel(
                                      transaction.type
                                    )}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                                    Este movimiento viene de una regla fija. El
                                    objetivo semanal lo calcula desde la regla
                                    recurrente, no desde esta copia confirmada.
                                  </p>
                                </div>
                              ) : (
                                <label className="field-label lg:col-span-4">
                                  Impacto en objetivo semanal
                                  <select
                                    className="field-input"
                                    defaultValue={
                                      transaction.weeklyBudgetImpactScope
                                    }
                                    name="weeklyBudgetImpactScope"
                                  >
                                    {getWeeklyBudgetImpactOptions(
                                      transaction.type
                                    ).map((option) => (
                                      <option
                                        key={option.value}
                                        value={option.value}
                                      >
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              )}
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

function getRecentTransactionEditBlockReason(transaction: {
  isPeriodClosed?: boolean;
  savingsTransferId?: string | null;
  affectsRealBalance?: boolean;
  monthlyCloseId: string | null;
  originalReimbursement: { id: string } | null;
  recurringOccurrence: { id: string } | null;
  reimbursementId: string | null;
  type: TransactionType;
}): string | null {
  if (transaction.isPeriodClosed) return "Reabre el mes para modificar sus movimientos.";
  if (transaction.savingsTransferId) return "Transferencia entre partidas; gestiónala desde su histórico.";
  if (transaction.type === "expense" && transaction.affectsRealBalance === false) return "Gasto convertido; gestiónalo desde reembolsos.";
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

function getWeeklyBudgetImpactBadgeLabel(
  scope: WeeklyBudgetImpactScope
): string | null {
  return WEEKLY_BUDGET_IMPACT_SCOPE_BADGE_LABELS[scope];
}

function getRecurringBudgetBadgeLabel(type: TransactionType): string {
  if (type === "income") {
    return "Ingreso fijo ya incluido";
  }

  if (type === "expense") {
    return "Gasto fijo ya incluido";
  }

  return "Movimiento fijo";
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
