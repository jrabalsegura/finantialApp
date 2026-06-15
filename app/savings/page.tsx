import Link from "next/link";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import {
  allocateToSavingsBucket,
  createSavingsBucket,
  deleteSavingsBucket,
  updateSavingsBucket,
  withdrawFromSavingsBucket
} from "../actions";
import { prisma } from "@/lib/prisma";
import {
  calculateAssignedSavings,
  calculateAvailableMoney,
  calculateUnassignedAvailableMoney,
  toMoneyNumber
} from "@/domain/financial-calculations";
import {
  currencyFormatter,
  formatDateInputValue
} from "@/lib/formatters";

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
        includeInNetWorth: true,
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

  const defaultAccount =
    accounts.find((account) => account.name === "Openbank principal") ??
    accounts.find((account) => account.isDefault) ??
    accounts[0];
  const availableMoney = calculateAvailableMoney(accounts);
  const assignedMoney = calculateAssignedSavings(savingsBuckets);
  const unassignedMoney = calculateUnassignedAvailableMoney(
    accounts,
    savingsBuckets
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Ahorro
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Partidas de ahorro
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Movimientos
            </Link>
            <Link className="nav-link" href="/accounts">
              Cuentas
            </Link>
          </nav>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Dinero disponible" value={availableMoney} />
          <Metric label="Dinero asignado" value={assignedMoney} />
          <Metric label="Dinero no asignado" value={unassignedMoney} />
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Partidas</h2>
          </div>

          {savingsBuckets.length > 0 ? (
            <ul className="divide-y divide-line">
              {savingsBuckets.map((bucket) => {
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
                    <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
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
                        <p className="text-sm text-muted">
                          {targetAmount
                            ? `${currencyFormatter.format(amount)} de ${currencyFormatter.format(targetAmount)}`
                            : "Sin objetivo definido"}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-ink">
                        {currencyFormatter.format(amount)}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <form
                        action={allocateToSavingsBucket}
                        className="grid gap-3 rounded-lg border border-line bg-surface p-3"
                      >
                        <input
                          name="savingsBucketId"
                          type="hidden"
                          value={bucket.id}
                        />
                        <input
                          name="accountId"
                          type="hidden"
                          value={defaultAccount?.id ?? ""}
                        />
                        <label className="field-label">
                          Asignar importe
                          <input
                            className="field-input"
                            min="0.01"
                            name="amount"
                            required
                            step="0.01"
                            type="number"
                          />
                        </label>
                        <input
                          className="field-input"
                          name="description"
                          placeholder="Descripción opcional"
                          type="text"
                        />
                        <button className="primary-button" type="submit">
                          Asignar
                        </button>
                      </form>

                      <form
                        action={withdrawFromSavingsBucket}
                        className="grid gap-3 rounded-lg border border-line bg-surface p-3"
                      >
                        <input
                          name="savingsBucketId"
                          type="hidden"
                          value={bucket.id}
                        />
                        <input
                          name="accountId"
                          type="hidden"
                          value={defaultAccount?.id ?? ""}
                        />
                        <label className="field-label">
                          Retirar importe
                          <input
                            className="field-input"
                            max={amount}
                            min="0.01"
                            name="amount"
                            required
                            step="0.01"
                            type="number"
                          />
                        </label>
                        <input
                          className="field-input"
                          name="description"
                          placeholder="Descripción opcional"
                          type="text"
                        />
                        <button className="primary-button" type="submit">
                          Retirar
                        </button>
                      </form>
                    </div>

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
                        disabled={hasRelations}
                        title={
                          hasRelations
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
            <SavingsBucketFields />
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
  bucket
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

        <label className="field-label">
          Importe asignado
          <input
            className="field-input"
            defaultValue={bucket?.currentAmount ?? 0}
            name="currentAmount"
            step="0.01"
            type="number"
          />
        </label>

        <label className="field-label">
          Objetivo
          <input
            className="field-input"
            defaultValue={bucket?.targetAmount ?? ""}
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

        <label className="check-row self-end">
          <input
            defaultChecked={bucket?.isLongTerm ?? false}
            name="isLongTerm"
            type="checkbox"
          />
          Largo plazo
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
      <p className="mt-2 text-2xl font-semibold text-ink">
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}
