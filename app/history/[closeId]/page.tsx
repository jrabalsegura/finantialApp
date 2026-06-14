import Link from "next/link";
import { notFound } from "next/navigation";
import {
  calculateNetWorthVariation,
  toMoneyNumber
} from "@/domain/financial-calculations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

const monthFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric"
});

const accountTypeLabels = {
  cash: "Efectivo",
  checking: "Corriente",
  investment: "Inversión",
  other: "Otra",
  pension: "Plan de pensiones",
  savings: "Ahorro",
  treasury: "Tesoro"
};

export default async function MonthlyCloseDetailPage({
  params
}: {
  params: Promise<{ closeId: string }>;
}) {
  const { closeId } = await params;
  const close = await prisma.monthlyClose.findUnique({
    where: { id: closeId },
    include: {
      accountSnapshots: {
        orderBy: { account: { name: "asc" } },
        include: {
          account: {
            select: {
              name: true,
              type: true
            }
          },
          adjustmentTransaction: {
            select: {
              description: true
            }
          }
        }
      },
      bucketSnapshots: {
        orderBy: { savingsBucket: { name: "asc" } },
        include: {
          savingsBucket: {
            select: {
              name: true,
              isLongTerm: true
            }
          }
        }
      }
    }
  });

  if (!close) {
    notFound();
  }

  const previousClose = await prisma.monthlyClose.findFirst({
    where: {
      OR: [
        { year: { lt: close.year } },
        {
          year: close.year,
          month: { lt: close.month }
        }
      ]
    },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      year: true,
      month: true,
      netWorth: true
    }
  });

  const variation = calculateNetWorthVariation(
    close.netWorth,
    previousClose?.netWorth
  );
  const monthLabel = formatMonth(close.year, close.month);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <Link className="text-sm font-semibold text-accent" href="/history">
              Volver al histórico
            </Link>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Detalle del cierre
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              {monthLabel}
            </h1>
            <p className="text-sm text-muted">
              {close.closedAt
                ? `Cerrado el ${dateFormatter.format(close.closedAt)}`
                : "Cierre guardado"}
            </p>
          </div>
          <Link className="nav-link" href="/">
            Dashboard
          </Link>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Ingresos" value={toMoneyNumber(close.totalIncome)} />
          <Metric label="Gastos" value={toMoneyNumber(close.totalExpense)} />
          <Metric
            label="Ahorro mensual"
            tone
            value={toMoneyNumber(close.monthlySavings)}
          />
          <Metric
            label="Dinero disponible"
            value={toMoneyNumber(close.availableMoney)}
          />
          <Metric
            label="Patrimonio total"
            value={toMoneyNumber(close.netWorth)}
          />
          <Metric
            emptyText="Sin cierre anterior"
            label="Variación patrimonial"
            tone
            value={variation}
          />
          <Metric
            label="Activos a largo plazo"
            value={toMoneyNumber(close.longTermAssets)}
          />
        </section>

        <section className="grid gap-3 border-y border-line py-5 sm:grid-cols-2">
          <div>
            <h2 className="text-base font-semibold text-ink">Ahorro mensual</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Ingresos personales menos gastos personales de este mes.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold text-ink">
              Variación patrimonial
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Diferencia de patrimonio frente a{" "}
              {previousClose
                ? formatMonth(previousClose.year, previousClose.month)
                : "un cierre anterior"}
              . Puede incluir ahorro, aportaciones y cambios de valoración.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Saldos por cuenta
            </h2>
            <p className="mt-1 text-sm text-muted">
              Comparación usada para confirmar el cierre.
            </p>
          </div>
          {close.accountSnapshots.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead className="bg-surface text-xs uppercase text-muted">
                    <tr>
                      <HeaderCell>Cuenta</HeaderCell>
                      <HeaderCell>Calculado</HeaderCell>
                      <HeaderCell>Real</HeaderCell>
                      <HeaderCell>Diferencia</HeaderCell>
                      <HeaderCell>Tratamiento</HeaderCell>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {close.accountSnapshots.map((snapshot) => (
                      <tr key={snapshot.id}>
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-ink">
                            {snapshot.account.name}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {accountTypeLabels[snapshot.account.type]}
                          </p>
                        </td>
                        <MoneyCell value={toMoneyNumber(snapshot.calculatedBalance)} />
                        <MoneyCell value={toMoneyNumber(snapshot.realBalance)} />
                        <MoneyCell
                          tone
                          value={toMoneyNumber(snapshot.difference)}
                        />
                        <td className="px-4 py-4 text-sm text-muted">
                          {formatAdjustment(snapshot.adjustmentTransaction)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-line sm:hidden">
                {close.accountSnapshots.map((snapshot) => (
                  <li className="grid gap-3 px-4 py-4" key={snapshot.id}>
                    <div>
                      <p className="font-semibold text-ink">
                        {snapshot.account.name}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {formatAdjustment(snapshot.adjustmentTransaction)}
                      </p>
                    </div>
                    <dl className="grid grid-cols-3 gap-2">
                      <CompactAmount
                        label="Calculado"
                        value={toMoneyNumber(snapshot.calculatedBalance)}
                      />
                      <CompactAmount
                        label="Real"
                        value={toMoneyNumber(snapshot.realBalance)}
                      />
                      <CompactAmount
                        label="Diferencia"
                        value={toMoneyNumber(snapshot.difference)}
                      />
                    </dl>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <EmptyRow text="Este cierre no contiene snapshots de cuentas." />
          )}
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Partidas de ahorro
            </h2>
          </div>
          {close.bucketSnapshots.length > 0 ? (
            <ul className="divide-y divide-line">
              {close.bucketSnapshots.map((snapshot) => (
                <li
                  className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5"
                  key={snapshot.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {snapshot.savingsBucket.name}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {snapshot.savingsBucket.isLongTerm
                        ? "Largo plazo"
                        : "Ahorro general"}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {currencyFormatter.format(toMoneyNumber(snapshot.amount))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyRow text="Este cierre no contiene snapshots de partidas." />
          )}
        </section>

        <section className="border-t border-line pt-5">
          <h2 className="text-lg font-semibold text-ink">Notas del cierre</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
            {close.notes || "No se añadieron notas a este cierre."}
          </p>
        </section>
      </div>
    </main>
  );
}

function Metric({
  emptyText,
  label,
  tone,
  value
}: {
  emptyText?: string;
  label: string;
  tone?: boolean;
  value: number | null;
}) {
  const color =
    tone && value !== null
      ? value >= 0
        ? "text-emerald-700"
        : "text-rose-700"
      : "text-ink";

  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>
        {value === null
          ? emptyText || "-"
          : currencyFormatter.format(value)}
      </p>
    </div>
  );
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>;
}

function MoneyCell({ tone, value }: { tone?: boolean; value: number }) {
  const color = tone
    ? value >= 0
      ? "text-emerald-700"
      : "text-rose-700"
    : "text-ink";

  return (
    <td className={`whitespace-nowrap px-4 py-4 text-sm font-semibold ${color}`}>
      {currencyFormatter.format(value)}
    </td>
  );
}

function CompactAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-ink">
        {currencyFormatter.format(value)}
      </dd>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-8 text-sm text-muted sm:px-5">{text}</p>;
}

function formatAdjustment(
  adjustment: { description: string | null } | null
): string {
  if (!adjustment) {
    return "Sin ajuste";
  }

  const [, treatment] = (adjustment.description || "").split(": ");
  return treatment
    ? treatment.charAt(0).toUpperCase() + treatment.slice(1)
    : "Ajuste de cierre";
}

function formatMonth(year: number, month: number): string {
  const value = monthFormatter.format(new Date(year, month - 1, 1));
  return value.charAt(0).toUpperCase() + value.slice(1);
}
