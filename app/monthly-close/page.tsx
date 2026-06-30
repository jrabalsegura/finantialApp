import Link from "next/link";
import { closeMonth, undoLatestMonthlyClose } from "../actions";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import { MonthlyCloseForm } from "../components/MonthlyCloseForm";
import {
  calculateRealMonthlyExpense,
  calculateRealMonthlyIncome,
  calculateRealMonthlySavings,
  calculateLongTermTransferAllocation,
  getMonthDateRange,
  toMoneyNumber
} from "@/domain/financial-calculations";
import type { MoneyValue } from "@/domain/financial-calculations";
import { prisma } from "@/lib/prisma";
import { generateRecurringOccurrencesForMonth } from "@/lib/recurring-transactions";
import {
  currencyFormatter,
  monthYearFormatter as monthFormatter
} from "@/lib/formatters";

export const dynamic = "force-dynamic";

type ExistingMonthlyClose = {
  id: string;
  accountSnapshots: Array<{
    account: { name: string };
    calculatedBalance: MoneyValue;
    difference: MoneyValue;
    realBalance: MoneyValue;
  }>;
  bucketSnapshots: Array<{
    amount: MoneyValue;
    savingsBucket: { isLongTerm: boolean; name: string };
    savingsBucketId: string;
  }>;
  monthlySavings: MoneyValue;
  notes: string | null;
  totalExpense: MoneyValue;
  totalIncome: MoneyValue;
};

type PreviousMonthlyCloseForComparison = {
  bucketSnapshots: Array<{
    amount: MoneyValue;
    savingsBucketId: string;
  }>;
} | null;

export default async function MonthlyClosePage({
  searchParams
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const query = await searchParams;
  const selectedPeriod = parsePeriod(query.period);
  const monthRange = getMonthDateRange(selectedPeriod.year, selectedPeriod.month);
  const today = new Date();

  if (
    selectedPeriod.year === today.getFullYear() &&
    selectedPeriod.month === today.getMonth() + 1
  ) {
    await generateRecurringOccurrencesForMonth(
      selectedPeriod.year,
      selectedPeriod.month
    );
  }

  const [
    accounts,
    savingsBuckets,
    monthlyTransactions,
    existingClose,
    previousCloseForComparison,
    latestClose,
    pendingRecurringCount
  ] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        currentBalance: true,
        includeInAvailableMoney: true,
        includeInNetWorth: true,
        includeInMonthlySavings: true,
        type: true
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
    prisma.transaction.findMany({
      where: {
        date: {
          gte: monthRange.start,
          lt: monthRange.end
        }
      },
      select: {
        account: {
          select: {
            includeInMonthlySavings: true,
            includeInNetWorth: true,
            type: true
          }
        },
        date: true,
        destinationAccount: {
          select: {
            includeInMonthlySavings: true,
            includeInNetWorth: true,
            type: true
          }
        },
        amount: true,
        type: true,
        affectsPersonalExpense: true,
        affectsPersonalIncome: true,
        affectsMonthlySavings: true,
        affectsNetWorth: true
      }
    }),
    prisma.monthlyClose.findUnique({
      where: {
        year_month: {
          year: selectedPeriod.year,
          month: selectedPeriod.month
        }
      },
      include: {
        accountSnapshots: {
          orderBy: {
            account: {
              name: "asc"
            }
          },
          include: {
            account: {
              select: {
                name: true
              }
            }
          }
        },
        bucketSnapshots: {
          orderBy: {
            savingsBucket: {
              name: "asc"
            }
          },
          include: {
            savingsBucket: {
              select: {
                isLongTerm: true,
                name: true
              }
            }
          }
        }
      }
    }),
    prisma.monthlyClose.findFirst({
      where: {
        OR: [
          { year: { lt: selectedPeriod.year } },
          {
            year: selectedPeriod.year,
            month: { lt: selectedPeriod.month }
          }
        ]
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: {
        bucketSnapshots: {
          select: {
            amount: true,
            savingsBucketId: true
          }
        }
      }
    }),
    prisma.monthlyClose.findFirst({
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true }
    }),
    prisma.recurringTransactionOccurrence.count({
      where: {
        year: selectedPeriod.year,
        month: selectedPeriod.month,
        status: "pending"
      }
    })
  ]);

  const totalIncome = calculateRealMonthlyIncome(
    monthlyTransactions,
    selectedPeriod.year,
    selectedPeriod.month
  );
  const totalExpense = calculateRealMonthlyExpense(
    monthlyTransactions,
    selectedPeriod.year,
    selectedPeriod.month
  );
  const monthlySavings = calculateRealMonthlySavings(
    monthlyTransactions,
    selectedPeriod.year,
    selectedPeriod.month
  );
  const longTermTransferAllocation =
    calculateLongTermTransferAllocation(monthlyTransactions);
  const monthLabel = capitalize(
    monthFormatter.format(
      new Date(selectedPeriod.year, selectedPeriod.month - 1, 1)
    )
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-3">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Cierre mensual
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Asistente de cierre
            </h1>
            <p className="text-sm text-muted">{monthLabel}</p>
          </div>
        </header>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Paso 1
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            Seleccionar mes
          </h2>
          <form className="mt-4 grid gap-3 sm:grid-cols-[220px_auto]" method="GET">
            <label className="field-label">
              Mes
              <input
                className="field-input"
                defaultValue={formatPeriodValue(selectedPeriod)}
                name="period"
                type="month"
              />
            </label>
            <button className="primary-button self-end" type="submit">
              Revisar mes
            </button>
          </form>
        </section>

        {pendingRecurringCount > 0 ? (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900 shadow-sm sm:p-5">
            <h2 className="font-semibold">Movimientos fijos pendientes</h2>
            <p className="mt-1 text-sm">
              Tienes movimientos fijos pendientes de confirmar u omitir antes
              de cerrar el mes.
            </p>
            <Link
              className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-amber-400 bg-white px-4 text-sm font-bold"
              href="/recurring"
            >
              Revisar {pendingRecurringCount} pendientes
            </Link>
          </section>
        ) : null}

        {existingClose ? (
          <ExistingClose
            close={existingClose}
            isLatestClose={latestClose?.id === existingClose.id}
            previousClose={previousCloseForComparison}
            returnTo={`/monthly-close?period=${formatPeriodValue(selectedPeriod)}`}
          />
        ) : (
          <MonthlyCloseForm
            accounts={accounts.map((account) => ({
              calculatedBalance: toMoneyNumber(account.currentBalance),
              id: account.id,
              includeInAvailableMoney: account.includeInAvailableMoney,
              includeInNetWorth: account.includeInNetWorth,
              includeInMonthlySavings: account.includeInMonthlySavings,
              name: account.name,
              type: account.type
            }))}
            action={closeMonth}
            baseMonthlySavings={monthlySavings}
            buckets={savingsBuckets.map((bucket) => ({
              currentAmount: toMoneyNumber(bucket.currentAmount),
              id: bucket.id,
              isLongTerm: bucket.isLongTerm,
              name: bucket.name,
              targetAmount: bucket.targetAmount
                ? toMoneyNumber(bucket.targetAmount)
                : null
            }))}
            longTermTransferAllocation={longTermTransferAllocation}
            month={selectedPeriod.month}
            totalExpense={totalExpense}
            totalIncome={totalIncome}
            year={selectedPeriod.year}
          />
        )}
      </div>
    </main>
  );
}

function ExistingClose({
  close,
  isLatestClose,
  previousClose,
  returnTo
}: {
  close: ExistingMonthlyClose;
  isLatestClose: boolean;
  previousClose: PreviousMonthlyCloseForComparison;
  returnTo: string;
}) {
  const previousBucketAmountById = new Map(
    previousClose?.bucketSnapshots.map((snapshot) => [
      snapshot.savingsBucketId,
      toMoneyNumber(snapshot.amount)
    ]) ?? []
  );
  const closeNotes = close.notes?.trim();

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Ingresos" value={toMoneyNumber(close.totalIncome)} />
        <Metric label="Gastos" value={toMoneyNumber(close.totalExpense)} />
        <Metric label="Ahorro mensual" value={toMoneyNumber(close.monthlySavings)} />
      </section>
      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Cierre guardado
              </h2>
              <p className="mt-1 text-sm text-muted">
                Este mes ya tiene snapshots mensuales.
              </p>
            </div>
            {isLatestClose ? (
              <UndoMonthlyCloseForm closeId={close.id} returnTo={returnTo} />
            ) : null}
          </div>
        </div>
        {!isLatestClose ? (
          <div className="border-b border-line bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 sm:px-5">
            Solo se puede deshacer el último cierre mensual.
          </div>
        ) : null}
        <ul className="divide-y divide-line">
          {close.accountSnapshots.map((snapshot) => (
            <li
              className="grid min-w-0 gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-center sm:px-5"
              key={snapshot.account.name}
            >
              <p className="text-sm font-semibold text-ink">
                {snapshot.account.name}
              </p>
              <p className="amount-text text-sm text-muted sm:text-right">
                Calculado:{" "}
                {currencyFormatter.format(
                  toMoneyNumber(snapshot.calculatedBalance)
                )}
              </p>
              <p className="amount-text text-sm text-muted sm:text-right">
                Real:{" "}
                {currencyFormatter.format(toMoneyNumber(snapshot.realBalance))}
              </p>
              <p className="amount-text text-sm font-semibold text-ink sm:text-right">
                Dif.:{" "}
                {currencyFormatter.format(toMoneyNumber(snapshot.difference))}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-lg font-semibold text-ink">
            Snapshots de partidas
          </h2>
        </div>
        {close.bucketSnapshots.length > 0 ? (
          <ul className="divide-y divide-line">
            {close.bucketSnapshots.map((snapshot) => {
              const amount = toMoneyNumber(snapshot.amount);
              const previousAmount = previousBucketAmountById.get(
                snapshot.savingsBucketId
              );
              const variation =
                previousAmount == null ? null : roundMoney(amount - previousAmount);

              return (
                <li
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-5"
                  key={snapshot.savingsBucketId}
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
                  <p className="amount-text text-sm font-semibold text-ink sm:text-right">
                    {currencyFormatter.format(amount)}
                  </p>
                  <BucketVariation value={variation} />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-8 text-sm text-muted sm:px-5">
            Este cierre no tiene partidas de ahorro guardadas.
          </div>
        )}
      </section>

      {closeNotes ? (
        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Notas del cierre</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
            {closeNotes}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function UndoMonthlyCloseForm({
  closeId,
  returnTo
}: {
  closeId: string;
  returnTo: string;
}) {
  return (
    <form action={undoLatestMonthlyClose}>
      <input name="closeId" type="hidden" value={closeId} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <ConfirmSubmitButton
        className="inline-flex min-h-11 items-center justify-center rounded-lg border border-rose-300 bg-rose-50 px-4 text-sm font-bold text-rose-800 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
        confirmMessage="¿Deshacer el último cierre mensual? Se revertirán sus ajustes de cuenta y sus asignaciones o reducciones de partidas."
      >
        Deshacer cierre
      </ConfirmSubmitButton>
    </form>
  );
}

function BucketVariation({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <p className="text-sm font-medium text-muted sm:text-right">
        Sin cierre anterior
      </p>
    );
  }

  if (value === 0) {
    return (
      <p className="amount-text text-sm font-semibold text-muted sm:text-right">
        Sin cambios
      </p>
    );
  }

  const isPositive = value > 0;

  return (
    <p
      className={`amount-text text-sm font-semibold sm:text-right ${
        isPositive ? "text-emerald-700" : "text-rose-700"
      }`}
    >
      {isPositive ? "Sube " : "Baja "}
      {isPositive
        ? `+${currencyFormatter.format(value)}`
        : currencyFormatter.format(value)}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="amount-text mt-2 text-2xl font-semibold text-ink">
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}

function parsePeriod(value: string | undefined): { month: number; year: number } {
  if (value) {
    const [yearValue, monthValue] = value.split("-");
    const year = Number(yearValue);
    const month = Number(monthValue);

    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      year >= 2000 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12
    ) {
      return { year, month };
    }
  }

  const today = new Date();

  return {
    year: today.getFullYear(),
    month: today.getMonth() + 1
  };
}

function formatPeriodValue(period: { month: number; year: number }): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
