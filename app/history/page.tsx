import Link from "next/link";
import {
  calculateNetWorthVariation,
  toMoneyNumber
} from "@/domain/financial-calculations";
import {
  currencyFormatter,
  monthYearFormatter
} from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const closes = await prisma.monthlyClose.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: {
      id: true,
      year: true,
      month: true,
      totalIncome: true,
      totalExpense: true,
      monthlySavings: true,
      availableMoney: true,
      netWorth: true,
      longTermAssets: true,
      notes: true
    }
  });

  const rows = closes.map((close, index) => ({
    ...close,
    netWorthVariation: calculateNetWorthVariation(
      close.netWorth,
      closes[index + 1]?.netWorth
    )
  }));

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-7xl gap-6">
        <header className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Histórico mensual
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Evolución financiera
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted">
              Cada fila conserva las cifras confirmadas y los saldos reales de
              un cierre mensual.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Dashboard
            </Link>
            <Link className="nav-link" href="/monthly-close">
              Nuevo cierre
            </Link>
          </nav>
        </header>

        {rows.length > 0 ? (
          <>
            <section className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-sm md:block">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead className="bg-surface text-xs uppercase text-muted">
                  <tr>
                    <HeaderCell>Mes</HeaderCell>
                    <HeaderCell>Ingresos</HeaderCell>
                    <HeaderCell>Gastos</HeaderCell>
                    <HeaderCell>Ahorro mensual</HeaderCell>
                    <HeaderCell>Disponible</HeaderCell>
                    <HeaderCell>Patrimonio</HeaderCell>
                    <HeaderCell>Variación</HeaderCell>
                    <HeaderCell>Largo plazo</HeaderCell>
                    <HeaderCell>Notas</HeaderCell>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((close) => (
                    <tr className="align-top" key={close.id}>
                      <td className="px-4 py-4">
                        <Link
                          className="font-semibold text-accent hover:underline"
                          href={`/history/${close.id}`}
                        >
                          {formatMonth(close.year, close.month)}
                        </Link>
                      </td>
                      <MoneyCell value={toMoneyNumber(close.totalIncome)} />
                      <MoneyCell value={toMoneyNumber(close.totalExpense)} />
                      <MoneyCell
                        tone
                        value={toMoneyNumber(close.monthlySavings)}
                      />
                      <MoneyCell value={toMoneyNumber(close.availableMoney)} />
                      <MoneyCell value={toMoneyNumber(close.netWorth)} />
                      <VariationCell value={close.netWorthVariation} />
                      <MoneyCell value={toMoneyNumber(close.longTermAssets)} />
                      <td className="max-w-56 px-4 py-4 text-sm text-muted">
                        {close.notes || "Sin notas"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="grid gap-3 md:hidden">
              {rows.map((close) => (
                <Link
                  className="rounded-lg border border-line bg-white p-4 shadow-sm"
                  href={`/history/${close.id}`}
                  key={close.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-semibold text-ink">
                      {formatMonth(close.year, close.month)}
                    </h2>
                    <span className="text-sm font-semibold text-accent">
                      Ver detalle
                    </span>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                    <MobileMetric
                      label="Ingresos"
                      value={toMoneyNumber(close.totalIncome)}
                    />
                    <MobileMetric
                      label="Gastos"
                      value={toMoneyNumber(close.totalExpense)}
                    />
                    <MobileMetric
                      label="Ahorro"
                      value={toMoneyNumber(close.monthlySavings)}
                    />
                    <MobileMetric
                      label="Disponible"
                      value={toMoneyNumber(close.availableMoney)}
                    />
                    <MobileMetric
                      label="Patrimonio"
                      value={toMoneyNumber(close.netWorth)}
                    />
                    <MobileMetric
                      label="Variación"
                      value={close.netWorthVariation}
                    />
                  </dl>
                </Link>
              ))}
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-line bg-white px-5 py-10 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-ink">
              Aún no hay meses cerrados
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
              El histórico aparecerá al guardar el primer cierre mensual con
              sus saldos reales y snapshots.
            </p>
            <Link className="primary-button mt-5" href="/monthly-close">
              Crear primer cierre
            </Link>
          </section>
        )}
      </div>
    </main>
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

function VariationCell({ value }: { value: number | null }) {
  if (value === null) {
    return <td className="px-4 py-4 text-sm text-muted">Sin mes anterior</td>;
  }

  return <MoneyCell tone value={value} />;
}

function MobileMetric({
  label,
  value
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-ink">
        {value === null ? "Sin mes anterior" : currencyFormatter.format(value)}
      </dd>
    </div>
  );
}

function formatMonth(year: number, month: number): string {
  const value = monthYearFormatter.format(new Date(year, month - 1, 1));
  return value.charAt(0).toUpperCase() + value.slice(1);
}
