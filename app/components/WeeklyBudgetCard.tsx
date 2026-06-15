import Link from "next/link";
import type { WeeklyBudgetStatus } from "@/domain/weekly-budget";
import { currencyFormatter } from "@/lib/formatters";

export function WeeklyBudgetCard({
  status
}: {
  status: WeeklyBudgetStatus;
}) {
  const progress = Math.min(Math.max(status.percentageUsed ?? 0, 0), 100);
  const isOverBudget = status.currentWeekDifference < 0;
  const hasNegativeMonthlyBudget = status.monthlyVariableBudget < 0;

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
              value={status.currentWeekAvailableBudget}
            />
            <BudgetMetric
              label={isOverBudget ? "Exceso" : "Restante"}
              negative={isOverBudget}
              value={Math.abs(status.currentWeekDifference)}
            />
          </div>

          {status.currentWeekAvailableBudget > 0 ? (
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
                {status.percentageUsed?.toLocaleString("es-ES", {
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
            {status.message}
          </p>
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
