import Link from "next/link";
import type { WeeklyBudgetStatus } from "@/domain/weekly-budget";
import { currencyFormatter } from "@/lib/formatters";

const WEEKLY_VISIBLE_BUDGET_CAP = 500;

export function WeeklyBudgetCard({
  closedMonthHref = "/monthly-close",
  isMonthClosed = false,
  monthLabel,
  status
}: {
  closedMonthHref?: string;
  isMonthClosed?: boolean;
  monthLabel?: string;
  status: WeeklyBudgetStatus;
}) {
  if (isMonthClosed) {
    return (
      <Link
        className="block overflow-hidden rounded-xl border border-line bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
        href={closedMonthHref}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Objetivo semanal
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
              Mes cerrado
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink">
            Ver cierre
          </span>
        </div>
        <div className="mt-5 rounded-lg bg-surface p-4">
          <p className="text-sm font-semibold text-ink">
            {monthLabel
              ? `${monthLabel} ya está cerrado.`
              : "Este mes ya está cerrado."}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            El gasto semanal queda pausado y se recalculará con el próximo mes.
          </p>
        </div>
      </Link>
    );
  }

  const visibleAvailableBudget = getVisibleAvailableBudget(
    status.currentWeekAvailableBudget
  );
  const visibleWeekDifference = roundMoney(
    visibleAvailableBudget - status.currentWeekVariableExpense
  );
  const visiblePercentageUsed =
    visibleAvailableBudget > 0
      ? roundPercentage(
          (status.currentWeekVariableExpense / visibleAvailableBudget) * 100
        )
      : null;
  const progress = Math.min(Math.max(visiblePercentageUsed ?? 0, 0), 100);
  const isOverBudget = visibleWeekDifference < 0;
  const hasNegativeMonthlyBudget = status.monthlyVariableBudget < 0;
  const isVisibleBudgetCapped =
    status.currentWeekAvailableBudget > visibleAvailableBudget;
  const message = getVisibleStatusMessage({
    hasNegativeMonthlyBudget,
    hasSufficientConfiguration: status.hasSufficientConfiguration,
    visiblePercentageUsed,
    visibleWeekDifference
  });

  return (
    <Link
      className={`block overflow-hidden rounded-xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 ${
        isOverBudget || hasNegativeMonthlyBudget
          ? "border-rose-300 bg-rose-50"
          : "border-emerald-300 bg-emerald-950 text-white"
      }`}
      href="/weekly-budget"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p
            className={`text-sm font-semibold uppercase tracking-wide ${
              isOverBudget || hasNegativeMonthlyBudget
                ? "text-rose-800"
                : "text-emerald-200"
            }`}
          >
            Objetivo semanal
          </p>
          <h2
            className={`mt-1 text-xl font-semibold sm:text-2xl ${
              isOverBudget || hasNegativeMonthlyBudget
                ? "text-rose-950"
                : "text-white"
            }`}
          >
            Gasto semanal disponible
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            isOverBudget || hasNegativeMonthlyBudget
              ? "bg-white text-rose-800"
              : "bg-white/10 text-emerald-100"
          }`}
        >
          Ver detalle
        </span>
      </div>

      {status.hasSufficientConfiguration ? (
        <>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <BudgetMetric
              label="Gastado"
              negative={isOverBudget}
              value={status.currentWeekVariableExpense}
            />
            <BudgetMetric
              label="Disponible"
              negative={isOverBudget}
              value={visibleAvailableBudget}
            />
            <BudgetMetric
              label={isOverBudget ? "Exceso" : "Restante"}
              negative={isOverBudget}
              value={Math.abs(visibleWeekDifference)}
            />
          </div>

          {visibleAvailableBudget > 0 ? (
            <div className="mt-5">
              <div
                className={`h-3 overflow-hidden rounded-full ${
                  isOverBudget ? "bg-rose-200" : "bg-white/15"
                }`}
              >
                <div
                  className={`h-full rounded-full ${
                    isOverBudget ? "bg-rose-700" : "bg-emerald-300"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p
                className={`mt-2 text-xs ${
                  isOverBudget ? "text-rose-800" : "text-emerald-100"
                }`}
              >
                {visiblePercentageUsed?.toLocaleString("es-ES", {
                  maximumFractionDigits: 1
                })}
                % usado
              </p>
            </div>
          ) : null}

          <p
            className={`mt-4 text-sm font-semibold ${
              isOverBudget || hasNegativeMonthlyBudget
                ? "text-rose-950"
                : "text-white"
            }`}
          >
            {message}
          </p>
          {isVisibleBudgetCapped ? (
            <p
              className={`mt-2 text-xs ${
                isOverBudget ? "text-rose-800" : "text-emerald-100"
              }`}
            >
              Disponible real por fórmula:{" "}
              {currencyFormatter.format(status.currentWeekAvailableBudget)}. La
              card usa un máximo semanal de{" "}
              {currencyFormatter.format(WEEKLY_VISIBLE_BUDGET_CAP)}.
            </p>
          ) : null}
          {status.currentWeekTransferredOutOfAvailable > 0 ? (
            <p
              className={`mt-2 text-xs ${
                isOverBudget ? "text-rose-800" : "text-emerald-100"
              }`}
            >
              El disponible ya descuenta{" "}
              {currencyFormatter.format(
                status.currentWeekTransferredOutOfAvailable
              )}{" "}
              trasladados a cuentas no disponibles.
            </p>
          ) : null}
        </>
      ) : (
        <div className="mt-5 rounded-lg bg-white/10 p-4">
          <p className="text-sm leading-6 text-white">{status.message}</p>
          <p className="mt-2 text-xs text-emerald-100">
            Configura al menos un ingreso recurrente mensual para activar el
            cálculo.
          </p>
        </div>
      )}
    </Link>
  );
}

function getVisibleAvailableBudget(currentWeekAvailableBudget: number): number {
  return Math.min(currentWeekAvailableBudget, WEEKLY_VISIBLE_BUDGET_CAP);
}

function getVisibleStatusMessage({
  hasNegativeMonthlyBudget,
  hasSufficientConfiguration,
  visiblePercentageUsed,
  visibleWeekDifference
}: {
  hasNegativeMonthlyBudget: boolean;
  hasSufficientConfiguration: boolean;
  visiblePercentageUsed: number | null;
  visibleWeekDifference: number;
}): string {
  if (!hasSufficientConfiguration) {
    return "No hay ingresos fijos recurrentes suficientes para calcular el objetivo semanal.";
  }

  if (hasNegativeMonthlyBudget) {
    return "Tus gastos fijos y tu objetivo de ahorro superan los ingresos fijos del mes.";
  }

  if (visibleWeekDifference < 0) {
    return `Te has pasado en ${currencyFormatter.format(
      Math.abs(visibleWeekDifference)
    )} esta semana.`;
  }

  if (visiblePercentageUsed !== null && visiblePercentageUsed >= 85) {
    return `Cuidado: has usado el ${Math.round(
      visiblePercentageUsed
    )}% del presupuesto semanal.`;
  }

  return `Vas bien: te quedan ${currencyFormatter.format(
    visibleWeekDifference
  )} esta semana.`;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundPercentage(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

function BudgetMetric({
  label,
  negative,
  value
}: {
  label: string;
  negative: boolean;
  value: number;
}) {
  return (
    <div
      className={`min-w-0 rounded-lg p-3 ${
        negative ? "bg-white" : "bg-white/10"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-wide ${
          negative ? "text-rose-700" : "text-emerald-200"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 truncate text-base font-semibold sm:text-xl ${
          negative ? "text-rose-950" : "text-white"
        }`}
        title={currencyFormatter.format(value)}
      >
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}
