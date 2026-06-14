"use client";

import { useActionState, useMemo, useState } from "react";
import type { closeMonth, MonthlyCloseFormState } from "../actions";

type MonthlyCloseAccount = {
  calculatedBalance: number;
  id: string;
  includeInAvailableMoney: boolean;
  includeInNetWorth: boolean;
  name: string;
};

type MonthlyCloseBucket = {
  currentAmount: number;
  id: string;
  isLongTerm: boolean;
  name: string;
};

type AdjustmentKind =
  | "expense"
  | "income"
  | "technical"
  | "unassigned_savings";

type MonthlyCloseFormProps = {
  accounts: MonthlyCloseAccount[];
  action: typeof closeMonth;
  baseMonthlySavings: number;
  buckets: MonthlyCloseBucket[];
  month: number;
  totalExpense: number;
  totalIncome: number;
  year: number;
};

const initialState: MonthlyCloseFormState = {
  status: "idle",
  message: ""
};

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

export function MonthlyCloseForm({
  accounts,
  action,
  baseMonthlySavings,
  buckets,
  month,
  totalExpense,
  totalIncome,
  year
}: MonthlyCloseFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [confirmed, setConfirmed] = useState(false);
  const [realBalances, setRealBalances] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        accounts.map((account) => [
          account.id,
          formatInputAmount(account.calculatedBalance)
        ])
      )
  );
  const [adjustmentKinds, setAdjustmentKinds] = useState<
    Record<string, AdjustmentKind>
  >(() =>
    Object.fromEntries(
      accounts.map((account) => [account.id, "technical" as AdjustmentKind])
    )
  );
  const [allocations, setAllocations] = useState<Record<string, string>>(() =>
    Object.fromEntries(buckets.map((bucket) => [bucket.id, "0"]))
  );

  const accountRows = useMemo(
    () =>
      accounts.map((account) => {
        const realBalance = parseInputAmount(realBalances[account.id]);
        const difference = roundMoney(realBalance - account.calculatedBalance);
        const adjustmentKind = adjustmentKinds[account.id] ?? "technical";

        return {
          ...account,
          adjustmentKind,
          difference,
          realBalance
        };
      }),
    [accounts, adjustmentKinds, realBalances]
  );
  const estimatedMonthlySavings = roundMoney(
    accountRows.reduce((total, account) => {
      if (account.adjustmentKind === "income" && account.difference > 0) {
        return total + account.difference;
      }

      if (account.adjustmentKind === "expense" && account.difference < 0) {
        return total - Math.abs(account.difference);
      }

      return total;
    }, baseMonthlySavings)
  );
  const allocationTotal = roundMoney(
    buckets.reduce(
      (total, bucket) => total + parseInputAmount(allocations[bucket.id]),
      0
    )
  );
  const allocationRemaining = roundMoney(
    Math.max(estimatedMonthlySavings, 0) - allocationTotal
  );
  const hasInvalidAdjustment = accountRows.some(
    (account) =>
      (account.adjustmentKind === "expense" && account.difference > 0) ||
      (account.adjustmentKind === "income" && account.difference < 0)
  );
  const hasInvalidAllocation =
    allocationTotal < 0 ||
    allocationTotal > Math.max(estimatedMonthlySavings, 0);

  return (
    <form action={formAction} className="grid gap-6">
      <input name="month" type="hidden" value={month} />
      <input name="year" type="hidden" value={year} />

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <StepHeader
          step="2-5"
          title="Saldos, diferencias y ajustes"
          text="Revisa el saldo calculado, introduce el saldo real y decide cómo tratar cada diferencia antes de confirmar."
        />
        <ul className="divide-y divide-line">
          {accountRows.map((account) => (
            <li className="grid gap-4 px-4 py-4 sm:px-5" key={account.id}>
              <div className="grid gap-3 lg:grid-cols-[1fr_160px_160px_170px] lg:items-end">
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {account.name}
                  </p>
                  <p className="text-xs text-muted">
                    {[
                      account.includeInAvailableMoney ? "Disponible" : null,
                      account.includeInNetWorth ? "Patrimonio" : null
                    ]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </p>
                </div>
                <ReadOnlyAmount
                  label="Calculado"
                  value={account.calculatedBalance}
                />
                <label className="grid gap-2 text-sm font-medium text-ink">
                  Real
                  <input
                    className="field-input"
                    inputMode="decimal"
                    name={`realBalance_${account.id}`}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      const nextDifference = roundMoney(
                        parseInputAmount(nextValue) - account.calculatedBalance
                      );
                      const currentKind =
                        adjustmentKinds[account.id] ?? "technical";

                      setRealBalances((current) => ({
                        ...current,
                        [account.id]: nextValue
                      }));

                      if (
                        nextDifference > 0 &&
                        (account.difference === 0 || currentKind === "expense")
                      ) {
                        setAdjustmentKinds((current) => ({
                          ...current,
                          [account.id]: "income"
                        }));
                      }

                      if (
                        nextDifference < 0 &&
                        (account.difference === 0 || currentKind === "income")
                      ) {
                        setAdjustmentKinds((current) => ({
                          ...current,
                          [account.id]: "expense"
                        }));
                      }
                    }}
                    step="0.01"
                    type="number"
                    value={realBalances[account.id]}
                  />
                </label>
                <ReadOnlyAmount label="Diferencia" value={account.difference} />
              </div>

              {account.difference !== 0 ? (
                <label className="grid gap-2 text-sm font-medium text-ink sm:max-w-md">
                  Tipo de ajuste
                  <select
                    className="field-input"
                    name={`adjustmentKind_${account.id}`}
                    onChange={(event) =>
                      setAdjustmentKinds((current) => ({
                        ...current,
                        [account.id]: event.target.value as AdjustmentKind
                      }))
                    }
                    value={account.adjustmentKind}
                  >
                    <option value="expense">Gasto real</option>
                    <option value="income">Ingreso real</option>
                    <option value="technical">
                      Ajuste técnico sin impacto en informes
                    </option>
                    <option value="unassigned_savings">
                      Ajuste de ahorro no asignado
                    </option>
                  </select>
                </label>
              ) : (
                <input
                  name={`adjustmentKind_${account.id}`}
                  type="hidden"
                  value={account.adjustmentKind}
                />
              )}

              {account.adjustmentKind === "expense" && account.difference > 0 ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                  Esta diferencia aumenta el saldo real; si impacta en informes,
                  debe ser ingreso real.
                </p>
              ) : null}
              {account.adjustmentKind === "income" && account.difference < 0 ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                  Esta diferencia reduce el saldo real; si impacta en informes,
                  debe ser gasto real.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <StepHeader
          step="6"
          title="Ahorro mensual real"
          text="Se calcula con ingresos y gastos personales reales; los ajustes de gasto o ingreso real modifican esta estimación."
        />
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <Metric label="Ingresos reales" value={totalIncome} />
          <Metric label="Gastos reales" value={totalExpense} />
          <Metric
            label="Ahorro mensual estimado"
            value={estimatedMonthlySavings}
          />
        </div>
      </section>

      <section className="rounded-lg border border-line bg-white shadow-sm">
        <StepHeader
          step="7"
          title="Reparto del ahorro"
          text="El reparto crea asignaciones a partidas de ahorro y se guarda en el snapshot del mes."
        />
        {buckets.length > 0 ? (
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {buckets.map((bucket) => (
                <label
                  className="grid gap-2 rounded-lg border border-line bg-surface p-3 text-sm font-medium text-ink"
                  key={bucket.id}
                >
                  <span>
                    {bucket.name}
                    <span className="block text-xs font-normal text-muted">
                      Actual: {currencyFormatter.format(bucket.currentAmount)}
                    </span>
                  </span>
                  <input
                    className="field-input"
                    min="0"
                    name={`savingsAllocation_${bucket.id}`}
                    onChange={(event) =>
                      setAllocations((current) => ({
                        ...current,
                        [bucket.id]: event.target.value
                      }))
                    }
                    step="0.01"
                    type="number"
                    value={allocations[bucket.id]}
                  />
                </label>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="A repartir" value={Math.max(estimatedMonthlySavings, 0)} />
              <Metric label="Repartido" value={allocationTotal} />
              <Metric label="Restante" value={allocationRemaining} />
            </div>
            {hasInvalidAllocation ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                El reparto no puede superar el ahorro mensual positivo.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-muted sm:px-5">
            No hay partidas de ahorro para repartir.
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
        <StepHeader
          step="8"
          title="Guardar cierre"
          text="Al confirmar se crearán los ajustes, el cierre mensual y los snapshots."
        />
        <label className="field-label mt-4">
          Notas
          <textarea
            className="min-h-24 rounded-lg border border-line bg-white px-3 py-2 text-base outline-none focus:border-accent"
            name="notes"
            placeholder="Notas opcionales del cierre"
          />
        </label>
        <label className="mt-4 flex items-start gap-2 text-sm font-medium text-ink">
          <input
            checked={confirmed}
            className="mt-1"
            onChange={(event) => setConfirmed(event.target.checked)}
            type="checkbox"
          />
          Confirmo que los saldos reales son correctos y quiero guardar el cierre.
        </label>
        <button
          className="primary-button mt-4 w-full sm:w-auto"
          disabled={
            isPending ||
            !confirmed ||
            hasInvalidAdjustment ||
            hasInvalidAllocation
          }
          type="submit"
        >
          {isPending ? "Guardando cierre..." : "Confirmar cierre mensual"}
        </button>
        {state.message ? (
          <p
            className={`mt-4 rounded-lg px-3 py-2 text-sm font-medium ${
              state.status === "success"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-rose-50 text-rose-800"
            }`}
          >
            {state.message}
          </p>
        ) : null}
      </section>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}

function ReadOnlyAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <span className="flex h-12 items-center rounded-lg border border-line bg-surface px-3 text-base">
        {currencyFormatter.format(value)}
      </span>
    </div>
  );
}

function StepHeader({
  step,
  text,
  title
}: {
  step: string;
  text: string;
  title: string;
}) {
  return (
    <div className="border-b border-line px-4 py-3 sm:px-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent">
        Paso {step}
      </p>
      <h2 className="mt-1 text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{text}</p>
    </div>
  );
}

function formatInputAmount(value: number): string {
  return String(Math.round(value * 100) / 100);
}

function parseInputAmount(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const amount = Number(value.replace(",", "."));

  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
