import Link from "next/link";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import {
  createSavingsBucket,
  deleteSavingsBucket,
  transferBetweenSavingsBuckets,
  updateSavingsBucket
} from "../actions";
import { prisma } from "@/lib/prisma";
import {
  calculateAssignedSavings,
  calculateAvailableMoney,
  calculateLongTermBucketBalance,
  calculateUnassignedAvailableMoney,
  toMoneyNumber
} from "@/domain/financial-calculations";
import { formatPlainAmount } from "@/domain/money";
import {
  currencyFormatter,
  formatDateInputValue
} from "@/lib/formatters";
import { SavingsGoalProgress } from "../components/SavingsGoalProgress";

export const dynamic = "force-dynamic";

export default async function SavingsPage() {
  const [accounts, savingsBuckets] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        currentBalance: true,
        includeInAvailableMoney: true,
        includeInMonthlySavings: true,
        includeInNetWorth: true,
        type: true,
        isDefault: true
      }
    }),
    prisma.savingsBucket.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            transactions: true,
            recurringTransactions: true,
            monthlySnapshots: true
          }
        }
      }
    })
  ]);

  const availableMoney = calculateAvailableMoney(accounts);
  const longTermBalance = calculateLongTermBucketBalance(accounts);
  const displaySavingsBuckets = savingsBuckets.map((bucket) => ({
    ...bucket,
    currentAmount: bucket.isLongTerm
      ? {
          toNumber: () => longTermBalance
        }
      : bucket.currentAmount
  }));
  const manualSavingsBuckets = displaySavingsBuckets.filter(
    (bucket) => !bucket.isLongTerm
  );
  const assignedMoney = calculateAssignedSavings(manualSavingsBuckets);
  const unassignedMoney = calculateUnassignedAvailableMoney(
    accounts,
    manualSavingsBuckets
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Ahorro
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Partidas de ahorro
            </h1>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Dinero disponible" value={availableMoney} />
          <Metric label="Dinero asignado" value={assignedMoney} />
          <Metric label="Dinero no asignado" value={unassignedMoney} />
        </section>

        {manualSavingsBuckets.length >= 2 ? (
          <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-ink">
              Transferir entre partidas
            </h2>
            <form
              action={transferBetweenSavingsBuckets}
              className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px] lg:items-end"
            >
              <label className="field-label">
                Origen
                <select className="field-input" name="sourceBucketId" required>
                  <option value="">Elige partida</option>
                  {manualSavingsBuckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>
                      {bucket.name} ·{" "}
                      {currencyFormatter.format(
                        toMoneyNumber(bucket.currentAmount)
                      )}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Destino
                <select
                  className="field-input"
                  name="destinationBucketId"
                  required
                >
                  <option value="">Elige partida</option>
                  {manualSavingsBuckets.map((bucket) => (
                    <option key={bucket.id} value={bucket.id}>
                      {bucket.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Importe
                <input
                  className="field-input"
                  inputMode="decimal"
                  min="0.01"
                  name="amount"
                  required
                  step="0.01"
                  type="number"
                />
              </label>

              <label className="field-label lg:col-span-2">
                Nota opcional
                <input
                  className="field-input"
                  name="description"
                  placeholder="Ej. Reequilibrio de objetivos"
                  type="text"
                />
              </label>

              <button className="primary-button" type="submit">
                Transferir
              </button>
            </form>
          </section>
        ) : null}

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Partidas</h2>
          </div>

          {displaySavingsBuckets.length > 0 ? (
            <ul className="divide-y divide-line">
              {displaySavingsBuckets.map((bucket) => {
                const amount = toMoneyNumber(bucket.currentAmount);
                const targetAmount = bucket.targetAmount
                  ? toMoneyNumber(bucket.targetAmount)
                  : null;
                const hasRelations =
                  bucket._count.transactions > 0 ||
                  bucket._count.recurringTransactions > 0 ||
                  bucket._count.monthlySnapshots > 0;

                return (
                  <li className="grid gap-5 px-4 py-5 sm:px-5" key={bucket.id}>
                    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">
                            {bucket.name}
                          </h3>
                          {bucket.isLongTerm ? (
                            <span className="rounded-full bg-surface px-2 py-1 text-xs font-semibold text-muted">
                              Largo plazo
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className="amount-text text-lg font-semibold text-ink sm:text-right">
                        {currencyFormatter.format(amount)}
                      </p>
                    </div>

                    <SavingsGoalProgress
                      bucket={{
                        currentAmount: amount,
                        targetAmount
                      }}
                    />

                    <form action={updateSavingsBucket} className="grid gap-4">
                      <input name="id" type="hidden" value={bucket.id} />
                      <SavingsBucketFields
                        bucket={{
                          currentAmount: amount,
                          isLongTerm: bucket.isLongTerm,
                          name: bucket.name,
                          notes: bucket.notes,
                          priority: bucket.priority,
                          targetAmount,
                          targetDate: bucket.targetDate
                        }}
                      />
                      <button className="primary-button" type="submit">
                        Actualizar partida
                      </button>
                    </form>

                    <form action={deleteSavingsBucket}>
                      <input name="id" type="hidden" value={bucket.id} />
                      <ConfirmSubmitButton
                        className="danger-button"
                        confirmMessage={`¿Seguro que quieres eliminar la partida "${bucket.name}"? Esta acción no se puede deshacer.`}
                        disabled={bucket.isLongTerm || hasRelations}
                        title={
                          bucket.isLongTerm
                            ? "La partida Largo plazo se calcula desde cuentas"
                            : hasRelations
                            ? "No se puede borrar una partida con movimientos"
                            : undefined
                        }
                      >
                        Eliminar partida
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay partidas de ahorro.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Crear partida</h2>
          <form action={createSavingsBucket} className="mt-4 grid gap-4">
            <SavingsBucketFields mode="create" />
            <button className="primary-button" type="submit">
              Guardar partida
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function SavingsBucketFields({
  bucket,
  mode = "edit"
}: {
  bucket?: {
    currentAmount: number;
    isLongTerm: boolean;
    name: string;
    notes: string | null;
    priority: number | null;
    targetAmount: number | null;
    targetDate: Date | null;
  };
  mode?: "create" | "edit";
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field-label">
          Nombre
          <input
            className="field-input"
            defaultValue={bucket?.name}
            name="name"
            required
            type="text"
          />
        </label>

        {mode === "edit" ? (
          <div className="grid gap-2 text-sm font-medium text-ink">
            <span>
              {bucket?.isLongTerm ? "Importe derivado" : "Importe asignado"}
            </span>
            <span className="amount-text flex min-h-12 items-center rounded-lg border border-line bg-surface px-3 py-2 text-base">
              {currencyFormatter.format(bucket?.currentAmount ?? 0)}
            </span>
          </div>
        ) : (
          <label className="field-label">
            Saldo inicial
            <input
              className="field-input"
              inputMode="decimal"
              min="0"
              name="currentAmount"
              step="0.01"
              type="number"
            />
          </label>
        )}

        <label className="field-label">
          Objetivo
          <input
            className="field-input"
            defaultValue={
              bucket?.targetAmount === null ||
              bucket?.targetAmount === undefined
                ? ""
                : formatPlainAmount(bucket.targetAmount)
            }
            inputMode="decimal"
            min="0"
            name="targetAmount"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field-label">
          Fecha objetivo
          <input
            className="field-input"
            defaultValue={formatDateInputValue(bucket?.targetDate)}
            name="targetDate"
            type="date"
          />
        </label>

        <label className="field-label">
          Prioridad
          <input
            className="field-input"
            defaultValue={bucket?.priority ?? ""}
            name="priority"
            type="number"
          />
        </label>
      </div>

      <label className="field-label">
        Notas
        <input
          className="field-input"
          defaultValue={bucket?.notes ?? ""}
          name="notes"
          type="text"
        />
      </label>
    </>
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
