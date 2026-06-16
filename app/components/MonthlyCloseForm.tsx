"use client";

import { useActionState, useMemo, useState } from "react";
import type { closeMonth, MonthlyCloseFormState } from "../actions";
import {
  formatPlainAmount,
  normalizeMoney,
  parseMoneyInput
} from "@/domain/money";
import { currencyFormatter } from "@/lib/formatters";
import { getBucketGoalProgress } from "@/domain/savings-goals";
import { SavingsGoalProgress } from "./SavingsGoalProgress";
import {
  accountFeedsLongTermBucket,
  calculateLongTermBucketAdjustment,
  calculateLongTermBucketBalance,
  getManualMonthlyCloseResult,
  getMonthlyCloseResult
} from "@/domain/financial-calculations";

type MonthlyCloseAccount = {
  calculatedBalance: number;
  id: string;
  includeInAvailableMoney: boolean;
  includeInNetWorth: boolean;
  includeInMonthlySavings: boolean;
  name: string;
  type: string;
};

type MonthlyCloseBucket = {
  currentAmount: number;
  id: string;
  isLongTerm: boolean;
  name: string;
  targetAmount: number | null;
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
  longTermTransferAllocation: number;
  month: number;
  totalExpense: number;
  totalIncome: number;
  year: number;
};

const initialState: MonthlyCloseFormState = {
  status: "idle",
  message: ""
};

export function MonthlyCloseForm({
  accounts,
  action,
  baseMonthlySavings,
  buckets,
  longTermTransferAllocation,
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
  const [reductions, setReductions] = useState<Record<string, string>>(() =>
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
      if (accountFeedsLongTermBucket(account)) {
        return total;
      }

      if (account.adjustmentKind === "income" && account.difference > 0) {
        return total + account.difference;
      }

      if (account.adjustmentKind === "expense" && account.difference < 0) {
        return total - Math.abs(account.difference);
      }

      return total;
    }, baseMonthlySavings)
  );
  const closeResult = getMonthlyCloseResult(estimatedMonthlySavings);
  const longTermBucket = buckets.find((bucket) => bucket.isLongTerm) ?? null;
  const manualBuckets = buckets.filter((bucket) => !bucket.isLongTerm);
  const longTermBucketAdjustment = calculateLongTermBucketAdjustment(
    accountRows.map((account) => ({
      difference: account.difference,
      includeInMonthlySavings: account.includeInMonthlySavings,
      includeInNetWorth: account.includeInNetWorth,
      type: account.type
    }))
  );
  const currentLongTermBucketBalance = calculateLongTermBucketBalance(
    accountRows.map((account) => ({
      currentBalance: account.calculatedBalance,
      includeInMonthlySavings: account.includeInMonthlySavings,
      includeInNetWorth: account.includeInNetWorth,
      type: account.type
    }))
  );
  const finalLongTermBucketBalance = calculateLongTermBucketBalance(
    accountRows.map((account) => ({
      currentBalance: account.realBalance,
      includeInMonthlySavings: account.includeInMonthlySavings,
      includeInNetWorth: account.includeInNetWorth,
      type: account.type
    }))
  );
  const automaticLongTermSavings = roundMoney(
    longTermTransferAllocation + longTermBucketAdjustment
  );
  const manualCloseResult = getManualMonthlyCloseResult(
    estimatedMonthlySavings,
    automaticLongTermSavings
  );
  const allocationTotal = roundMoney(
    manualBuckets.reduce(
      (total, bucket) => total + parseInputAmount(allocations[bucket.id]),
      0
    )
  );
  const allocationRemaining = roundMoney(
    manualCloseResult.surplus - allocationTotal
  );
  const reductionTotal = roundMoney(
    manualBuckets.reduce(
      (total, bucket) => total + parseInputAmount(reductions[bucket.id]),
      0
    )
  );
  const reductionRemaining = roundMoney(
    closeResult.deficit - reductionTotal
  );
  const totalAvailableInBuckets = roundMoney(
    manualBuckets.reduce((total, bucket) => total + bucket.currentAmount, 0)
  );
  const hasReductionOverBalance = manualBuckets.some(
    (bucket) => parseInputAmount(reductions[bucket.id]) > bucket.currentAmount
  );
  const hasInvalidAdjustment = accountRows.some(
    (account) =>
      (account.adjustmentKind === "expense" && account.difference > 0) ||
      (account.adjustmentKind === "income" && account.difference < 0)
  );
  const hasInvalidAllocation =
    allocationTotal < 0 ||
    (manualCloseResult.kind === "positive"
      ? allocationTotal !== manualCloseResult.surplus
      : allocationTotal > 0);
  const hasInvalidReduction =
    reductionTotal < 0 ||
    hasReductionOverBalance ||
    (closeResult.kind === "negative"
      ? reductionTotal !== closeResult.deficit
      : reductionTotal > 0);
  const hasInsufficientBucketBalance =
    closeResult.kind === "negative" &&
    totalAvailableInBuckets < closeResult.deficit;

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
                      const feedsLongTermBucket =
                        accountFeedsLongTermBucket(account);

                      setRealBalances((current) => ({
                        ...current,
                        [account.id]: nextValue
                      }));

                      if (
                        !feedsLongTermBucket &&
                        nextDifference > 0 &&
                        (account.difference === 0 || currentKind === "expense")
                      ) {
                        setAdjustmentKinds((current) => ({
                          ...current,
                          [account.id]: "income"
                        }));
                      }

                      if (
                        !feedsLongTermBucket &&
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

              {account.difference !== 0 && accountFeedsLongTermBucket(account) ? (
                <div className="grid gap-2 sm:max-w-md">
                  <input
                    name={`adjustmentKind_${account.id}`}
                    type="hidden"
                    value="technical"
                  />
                  <p className="rounded-lg bg-surface px-3 py-2 text-sm font-medium text-muted">
                    Esta cuenta no cuenta para el ahorro mensual; su diferencia
                    se trata como ajuste técnico y se refleja en Largo plazo.
                  </p>
                </div>
              ) : account.difference !== 0 ? (
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
          title={getBucketStepTitle(manualCloseResult.kind)}
          text={getBucketStepText(manualCloseResult.kind)}
        />
        {longTermBucket ? (
          <DerivedLongTermBucket
            adjustment={longTermBucketAdjustment}
            automaticSavings={automaticLongTermSavings}
            bucketName={longTermBucket?.name ?? "Largo plazo"}
            currentAmount={currentLongTermBucketBalance}
            finalAmount={finalLongTermBucketBalance}
            transferAllocation={longTermTransferAllocation}
          />
        ) : null}
        {manualBuckets.length > 0 && manualCloseResult.kind === "positive" ? (
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {manualBuckets.map((bucket) => {
                const allocationAmount = parseInputAmount(
                  allocations[bucket.id]
                );
                const projectedProgress = getBucketGoalProgress({
                  currentAmount: bucket.currentAmount + allocationAmount,
                  targetAmount: bucket.targetAmount
                });

                return (
                  <div
                    className="grid gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-ink"
                    key={bucket.id}
                  >
                    <SavingsGoalProgress
                      bucket={{
                        currentAmount: bucket.currentAmount,
                        name: bucket.name,
                        targetAmount: bucket.targetAmount
                      }}
                      compact
                      showName
                    />
                    {allocationAmount > 0 && projectedProgress.hasGoal ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-xs text-muted">
                        Si asignas {currencyFormatter.format(allocationAmount)}:
                        nuevo saldo{" "}
                        {currencyFormatter.format(
                          projectedProgress.currentAmount
                        )}{" "}
                        /{" "}
                        {currencyFormatter.format(
                          projectedProgress.targetAmount ?? 0
                        )}
                        {" · "}
                        {formatPercentage(
                          Math.max(projectedProgress.percentage ?? 0, 0)
                        )}{" "}
                        cubierto.
                      </p>
                    ) : null}
                    <label className="grid gap-2 font-medium">
                      Asignar en este cierre
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
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="A repartir" value={manualCloseResult.surplus} />
              <Metric label="Repartido" value={allocationTotal} />
              <Metric label="Restante" value={allocationRemaining} />
            </div>
            {hasInvalidAllocation ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                Todo el ahorro mensual positivo debe quedar asignado a
                partidas, sin restante ni exceso.
              </p>
            ) : null}
          </div>
        ) : manualBuckets.length > 0 && manualCloseResult.kind === "negative" ? (
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
              <p className="font-semibold">
                Este mes tienes un déficit de{" "}
                {currencyFormatter.format(closeResult.deficit)}.
              </p>
              <p className="mt-1">
                Selecciona de qué partidas quieres descontarlo para cuadrar el
                cierre.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {manualBuckets.map((bucket) => {
                const reductionAmount = parseInputAmount(reductions[bucket.id]);
                const finalAmount = roundMoney(
                  bucket.currentAmount - reductionAmount
                );
                const currentProgress = getBucketGoalProgress({
                  currentAmount: bucket.currentAmount,
                  targetAmount: bucket.targetAmount
                });
                const finalProgress = getBucketGoalProgress({
                  currentAmount: finalAmount,
                  targetAmount: bucket.targetAmount
                });
                const isOverBalance = reductionAmount > bucket.currentAmount;

                return (
                  <div
                    className="grid gap-3 rounded-lg border border-line bg-surface p-3 text-sm text-ink"
                    key={bucket.id}
                  >
                    <SavingsGoalProgress
                      bucket={{
                        currentAmount: bucket.currentAmount,
                        name: bucket.name,
                        targetAmount: bucket.targetAmount
                      }}
                      compact
                      showName
                    />
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                      <BucketAmount label="Saldo actual" value={bucket.currentAmount} />
                      <BucketAmount label="Objetivo" value={bucket.targetAmount} />
                      <BucketAmount label="Saldo final" value={finalAmount} />
                      <BucketAmount
                        label="Hasta objetivo"
                        value={finalProgress.remainingAmount}
                      />
                    </div>
                    {currentProgress.hasGoal ? (
                      <p className="rounded-lg bg-white px-3 py-2 text-xs text-muted">
                        Actual: {formatPercentage(currentProgress.percentage ?? 0)}
                        {" · "}Final:{" "}
                        {formatPercentage(finalProgress.percentage ?? 0)}
                      </p>
                    ) : null}
                    <label className="grid gap-2 font-medium">
                      Reducir en este cierre
                      <input
                        className="field-input"
                        max={formatInputAmount(bucket.currentAmount)}
                        min="0"
                        name={`savingsReduction_${bucket.id}`}
                        onChange={(event) =>
                          setReductions((current) => ({
                            ...current,
                            [bucket.id]: event.target.value
                          }))
                        }
                        step="0.01"
                        type="number"
                        value={reductions[bucket.id]}
                      />
                    </label>
                    {isOverBalance ? (
                      <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-800">
                        No puedes reducir más que el saldo actual de la partida.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Déficit mensual" value={closeResult.deficit} />
              <Metric label="Total reducido" value={reductionTotal} />
              <Metric label="Pendiente" value={reductionRemaining} />
            </div>
            {hasInsufficientBucketBalance ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                No hay saldo suficiente en partidas para cubrir todo el déficit.
              </p>
            ) : null}
            {reductionRemaining > 0 && !hasInsufficientBucketBalance ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                Queda déficit pendiente de cubrir antes de guardar el cierre.
              </p>
            ) : null}
            {reductionRemaining < 0 ? (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                La reducción supera el déficit mensual.
              </p>
            ) : null}
          </div>
        ) : manualCloseResult.kind === "zero" ? (
          <div className="px-4 py-8 text-sm text-muted sm:px-5">
            No hay ahorro pendiente de repartir manualmente ni déficit que
            cubrir.
          </div>
        ) : (
          <div className="px-4 py-8 text-sm text-muted sm:px-5">
            No hay partidas de ahorro manuales disponibles para este cierre.
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
            hasInvalidAllocation ||
            hasInvalidReduction ||
            hasInsufficientBucketBalance
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
      <p className="amount-text mt-2 text-2xl font-semibold text-ink">
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}

function BucketAmount({
  label,
  value
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-lg bg-white px-3 py-2">
      <p className="font-medium text-muted">{label}</p>
      <p className="amount-text mt-1 text-sm font-semibold text-ink">
        {value == null ? "Sin objetivo" : currencyFormatter.format(value)}
      </p>
    </div>
  );
}

function DerivedLongTermBucket({
  adjustment,
  automaticSavings,
  bucketName,
  currentAmount,
  finalAmount,
  transferAllocation
}: {
  adjustment: number;
  automaticSavings: number;
  bucketName: string;
  currentAmount: number;
  finalAmount: number;
  transferAllocation: number;
}) {
  const tone =
    adjustment > 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : adjustment < 0
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : "border-line bg-surface text-muted";

  return (
    <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[1fr_180px] sm:items-end sm:p-5">
      <div className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
        <p className="font-semibold">
          Ajuste automático de {bucketName}:{" "}
          {currencyFormatter.format(adjustment)}
        </p>
        <p className="mt-1">
          Su saldo se calcula como la suma de las cuentas de largo plazo que no
          cuentan para el ahorro mensual. No se edita ni se reparte manualmente.
        </p>
        <p className="mt-1">
          Calculado: {currencyFormatter.format(currentAmount)} · Final:{" "}
          {currencyFormatter.format(finalAmount)}
        </p>
        <p className="mt-1">
          Ya asignado a Largo plazo este mes:{" "}
          {currencyFormatter.format(Math.max(automaticSavings, 0))}
          {transferAllocation !== 0 ? (
            <>
              {" "}
              ({currencyFormatter.format(transferAllocation)} por transferencias)
            </>
          ) : null}
        </p>
      </div>
      <label className="grid gap-2 text-sm font-medium text-ink">
        Largo plazo derivado
        <input
          className="field-input"
          inputMode="decimal"
          name="derivedLongTermBucketAmount"
          readOnly
          type="number"
          value={formatInputAmount(finalAmount)}
        />
      </label>
    </div>
  );
}

function ReadOnlyAmount({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-2 text-sm font-medium text-ink">
      <span>{label}</span>
      <span className="amount-text flex min-h-12 items-center rounded-lg border border-line bg-surface px-3 py-2 text-base">
        {currencyFormatter.format(value)}
      </span>
    </div>
  );
}

function getBucketStepTitle(kind: "positive" | "zero" | "negative"): string {
  if (kind === "positive") {
    return "Reparto del ahorro";
  }

  if (kind === "negative") {
    return "Cobertura del déficit";
  }

  return "Partidas de ahorro";
}

function getBucketStepText(kind: "positive" | "zero" | "negative"): string {
  if (kind === "positive") {
    return "El reparto crea asignaciones a partidas de ahorro y se guarda en el snapshot del mes.";
  }

  if (kind === "negative") {
    return "Las reducciones explican de qué ahorro asignado sale el déficit del mes y se guardan en el snapshot final.";
  }

  return "Con ahorro mensual cero no hace falta asignar ni reducir partidas para cuadrar el cierre.";
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
  return formatPlainAmount(value);
}

function parseInputAmount(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const amount = parseMoneyInput(value);

  return Number.isFinite(amount) ? amount : 0;
}

function roundMoney(value: number): number {
  return normalizeMoney(value);
}

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: value >= 100 ? 2 : 1,
    minimumFractionDigits: 0
  }).format(value)}%`;
}
