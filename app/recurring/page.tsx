import Link from "next/link";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import { RecurringTransactionFields } from "../components/RecurringTransactionFields";
import {
  confirmAllOccurrences,
  confirmOccurrence,
  createRecurringTransaction,
  deleteRecurringTransaction,
  editAndConfirmOccurrence,
  skipOccurrence,
  toggleRecurringTransaction,
  updateRecurringTransaction
} from "./actions";
import { getNextScheduledDate } from "@/domain/recurring-transactions";
import { toMoneyNumber } from "@/domain/financial-calculations";
import {
  RECURRING_OCCURRENCE_STATUS_LABELS,
  RECURRING_TRANSACTION_TYPE_LABELS
} from "@/domain/domain-options";
import {
  currencyFormatter,
  formatDateInputValue,
  shortDateFormatter as dateFormatter
} from "@/lib/formatters";
import { generateRecurringOccurrencesForMonth } from "@/lib/recurring-transactions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
const weekdayLabels = [
  "",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo"
];

export default async function RecurringPage() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;

  await generateRecurringOccurrencesForMonth(year, month);

  const [accounts, categories, savingsBuckets, templates, occurrences] =
    await Promise.all([
      prisma.account.findMany({
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
        select: { id: true, name: true, isDefault: true }
      }),
      prisma.category.findMany({
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: { id: true, name: true, type: true }
      }),
      prisma.savingsBucket.findMany({
        orderBy: [{ priority: "asc" }, { name: "asc" }],
        select: { id: true, name: true }
      }),
      prisma.recurringTransaction.findMany({
        orderBy: [
          { isActive: "desc" },
          { frequency: "asc" },
          { dayOfMonth: "asc" },
          { dayOfWeek: "asc" },
          { name: "asc" }
        ],
        include: {
          account: { select: { name: true } },
          destinationAccount: { select: { name: true } },
          category: { select: { name: true } },
          savingsBucket: { select: { name: true } },
          occurrences: {
            where: { year, month },
            select: { status: true }
          }
        }
      }),
      prisma.recurringTransactionOccurrence.findMany({
        where: { year, month },
        orderBy: [{ scheduledDate: "asc" }, { createdAt: "asc" }],
        include: {
          recurringTransaction: {
            include: {
              account: { select: { name: true } },
              destinationAccount: { select: { name: true } },
              category: { select: { name: true } },
              savingsBucket: { select: { name: true } }
            }
          }
        }
      })
    ]);

  const defaultAccount =
    accounts.find((account) => account.isDefault) ?? accounts[0];
  const pendingOccurrences = occurrences.filter(
    (occurrence) => occurrence.status === "pending"
  );
  const formOptions = {
    accounts: accounts.map(({ id, name }) => ({ id, name })),
    categories,
    defaultAccountId: defaultAccount?.id ?? "",
    savingsBuckets
  };

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Movimientos fijos
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Recurrentes mensuales y semanales
            </h1>
            <p className="text-sm text-muted">
              Revisa primero los pendientes; solo los confirmados afectan a tus
              saldos e informes.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Dashboard
            </Link>
            <Link className="nav-link" href="/monthly-close">
              Cierre
            </Link>
          </nav>
        </header>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="grid gap-3 border-b border-line px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Pendientes de este mes
              </h2>
              <p className="mt-1 text-sm text-muted">
                {pendingOccurrences.length} por revisar
              </p>
            </div>
            {pendingOccurrences.length > 0 ? (
              <form action={confirmAllOccurrences}>
                <input name="year" type="hidden" value={year} />
                <input name="month" type="hidden" value={month} />
                <ConfirmSubmitButton
                  className="primary-button w-full sm:w-auto"
                  confirmMessage={`¿Confirmar los ${pendingOccurrences.length} movimientos pendientes con sus importes y fechas previstos?`}
                >
                  Confirmar todos
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>

          {occurrences.length > 0 ? (
            <ul className="divide-y divide-line">
              {occurrences.map((occurrence) => {
                const template = occurrence.recurringTransaction;
                const amount = toMoneyNumber(occurrence.amount);

                return (
                  <li className="grid gap-4 px-4 py-5 sm:px-5" key={occurrence.id}>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-ink">
                            {template.name}
                          </h3>
                          <StatusBadge status={occurrence.status} />
                          <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                            {RECURRING_TRANSACTION_TYPE_LABELS[template.type]}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {formatRoute(template)} ·{" "}
                          {dateFormatter.format(occurrence.scheduledDate)}
                        </p>
                        {template.category ? (
                          <p className="mt-1 text-xs text-muted">
                            Categoría: {template.category.name}
                          </p>
                        ) : null}
                      </div>
                      <p className="text-xl font-semibold text-ink">
                        {currencyFormatter.format(amount)}
                      </p>
                    </div>

                    {occurrence.status === "pending" ? (
                      <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto]">
                        <form action={confirmOccurrence}>
                          <input
                            name="occurrenceId"
                            type="hidden"
                            value={occurrence.id}
                          />
                          <button
                            className="primary-button min-h-12 w-full"
                            type="submit"
                          >
                            Confirmar
                          </button>
                        </form>

                        <details className="rounded-lg border border-line bg-surface p-3">
                          <summary className="cursor-pointer text-sm font-semibold text-ink">
                            Editar importe o fecha y confirmar
                          </summary>
                          <form
                            action={editAndConfirmOccurrence}
                            className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
                          >
                            <input
                              name="occurrenceId"
                              type="hidden"
                              value={occurrence.id}
                            />
                            <label className="field-label">
                              Importe
                              <input
                                className="field-input"
                                defaultValue={amount}
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
                                defaultValue={formatDateInputValue(
                                  occurrence.scheduledDate
                                )}
                                name="date"
                                required
                                type="date"
                              />
                            </label>
                            <button
                              className="primary-button min-h-12 self-end"
                              type="submit"
                            >
                              Guardar y confirmar
                            </button>
                          </form>
                        </details>

                        <form action={skipOccurrence}>
                          <input
                            name="occurrenceId"
                            type="hidden"
                            value={occurrence.id}
                          />
                          <ConfirmSubmitButton
                            className="danger-button min-h-12 w-full"
                            confirmMessage={`¿Omitir "${template.name}" en esta fecha?`}
                          >
                            Omitir
                          </ConfirmSubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay ocurrencias recurrentes para este mes.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Plantillas</h2>
            <p className="mt-1 text-sm text-muted">
              Activa, edita o elimina tus movimientos mensuales y semanales.
            </p>
          </div>

          {templates.length > 0 ? (
            <ul className="divide-y divide-line">
              {templates.map((template) => {
                const nextDate = template.isActive
                  ? getNextScheduledDate(template, today)
                  : null;
                const occurrenceSummary = summarizeOccurrenceStatuses(
                  template.occurrences
                );

                return (
                  <li className="grid gap-4 px-4 py-5 sm:px-5" key={template.id}>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-ink">
                            {template.name}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              template.isActive
                                ? "bg-emerald-50 text-emerald-800"
                                : "bg-surface text-muted"
                            }`}
                          >
                            {template.isActive ? "Activa" : "Inactiva"}
                          </span>
                          <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                            {template.autoCreateMode === "pending"
                              ? "Revisión manual"
                              : "Automática"}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">
                          {RECURRING_TRANSACTION_TYPE_LABELS[template.type]} ·{" "}
                          {formatFrequency(template)} ·{" "}
                          {currencyFormatter.format(toMoneyNumber(template.amount))}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Próxima fecha:{" "}
                          {nextDate ? dateFormatter.format(nextDate) : "Sin próxima fecha"}
                          {" · "}
                          Mes actual:{" "}
                          {template.occurrences.length > 0
                            ? occurrenceSummary
                            : "No generado"}
                        </p>
                      </div>
                      <form action={toggleRecurringTransaction}>
                        <input name="id" type="hidden" value={template.id} />
                        <input
                          name="isActive"
                          type="hidden"
                          value={String(!template.isActive)}
                        />
                        <button className="nav-link w-full" type="submit">
                          {template.isActive ? "Desactivar" : "Activar"}
                        </button>
                      </form>
                    </div>

                    <details className="rounded-lg border border-line bg-surface p-3">
                      <summary className="cursor-pointer text-sm font-semibold text-ink">
                        Editar configuración
                      </summary>
                      <form action={updateRecurringTransaction} className="mt-4 grid gap-4">
                        <input name="id" type="hidden" value={template.id} />
                        <RecurringTransactionFields
                          {...formOptions}
                          template={{
                            accountId: template.accountId,
                            amount: toMoneyNumber(template.amount),
                            autoCreateMode: template.autoCreateMode,
                            categoryId: template.categoryId,
                            dayOfMonth: template.dayOfMonth,
                            dayOfWeek: template.dayOfWeek,
                            description: template.description,
                            destinationAccountId: template.destinationAccountId,
                            endDate: template.endDate
                              ? formatDateInputValue(template.endDate)
                              : "",
                            frequency: template.frequency,
                            isActive: template.isActive,
                            name: template.name,
                            savingsBucketId: template.savingsBucketId,
                            startDate: formatDateInputValue(template.startDate),
                            type: template.type
                          }}
                        />
                        <button className="primary-button" type="submit">
                          Guardar cambios
                        </button>
                      </form>
                    </details>

                    <form action={deleteRecurringTransaction}>
                      <input name="id" type="hidden" value={template.id} />
                      <ConfirmSubmitButton
                        className="danger-button"
                        confirmMessage={`¿Eliminar la plantilla "${template.name}"? Los movimientos reales ya confirmados se conservarán.`}
                      >
                        Eliminar plantilla
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay movimientos fijos configurados.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">
            Crear movimiento fijo
          </h2>
          {accounts.length > 0 ? (
            <form action={createRecurringTransaction} className="mt-4 grid gap-4">
              <RecurringTransactionFields
                {...formOptions}
                template={{
                  accountId: defaultAccount.id,
                  amount: 0,
                  autoCreateMode: "pending",
                  categoryId: null,
                  dayOfMonth: 1,
                  dayOfWeek: 1,
                  description: null,
                  destinationAccountId: null,
                  endDate: "",
                  frequency: "monthly",
                  isActive: true,
                  name: "",
                  savingsBucketId: null,
                  startDate: formatDateInputValue(
                    new Date(today.getFullYear(), today.getMonth(), 1, 12)
                  ),
                  type: "expense"
                }}
              />
              <button className="primary-button min-h-12" type="submit">
                Guardar plantilla
              </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-muted">
              Crea una cuenta antes de configurar movimientos recurrentes.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

function StatusBadge({
  status
}: {
  status: "pending" | "confirmed" | "skipped";
}) {
  const tone =
    status === "pending"
      ? "bg-amber-50 text-amber-800"
      : status === "confirmed"
        ? "bg-emerald-50 text-emerald-800"
        : "bg-surface text-muted";

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {RECURRING_OCCURRENCE_STATUS_LABELS[status]}
    </span>
  );
}

function formatRoute(template: {
  account: { name: string };
  destinationAccount: { name: string } | null;
  savingsBucket: { name: string } | null;
}): string {
  if (template.destinationAccount) {
    return `${template.account.name} → ${template.destinationAccount.name}`;
  }

  if (template.savingsBucket) {
    return `${template.account.name} → ${template.savingsBucket.name}`;
  }

  return template.account.name;
}

function formatFrequency(template: {
  frequency: "monthly" | "weekly";
  dayOfMonth: number;
  dayOfWeek: number;
}): string {
  return template.frequency === "weekly"
    ? `Cada ${weekdayLabels[template.dayOfWeek]}`
    : `Día ${template.dayOfMonth} de cada mes`;
}

function summarizeOccurrenceStatuses(
  occurrences: Array<{ status: "pending" | "confirmed" | "skipped" }>
): string {
  const counts = occurrences.reduce(
    (summary, occurrence) => {
      summary[occurrence.status] += 1;
      return summary;
    },
    { pending: 0, confirmed: 0, skipped: 0 }
  );

  return [
    counts.pending ? `${counts.pending} pendientes` : null,
    counts.confirmed ? `${counts.confirmed} confirmados` : null,
    counts.skipped ? `${counts.skipped} omitidos` : null
  ]
    .filter(Boolean)
    .join(" · ");
}
