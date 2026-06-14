import Link from "next/link";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import {
  createAccount,
  deleteAccount,
  updateAccount
} from "../actions";
import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/domain/financial-calculations";

export const dynamic = "force-dynamic";

const accountTypes = [
  { value: "checking", label: "Corriente" },
  { value: "savings", label: "Ahorro" },
  { value: "cash", label: "Efectivo" },
  { value: "investment", label: "Inversión" },
  { value: "pension", label: "Plan de pensiones" },
  { value: "treasury", label: "Tesoro" },
  { value: "other", label: "Otra" }
] as const;

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          transactions: true,
          incomingTransfers: true,
          monthlySnapshots: true
        }
      }
    }
  });

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Cuentas
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Gestión de cuentas
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Movimientos
            </Link>
            <Link className="nav-link" href="/savings">
              Partidas
            </Link>
          </nav>
        </header>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Cuentas</h2>
          </div>

          {accounts.length > 0 ? (
            <ul className="divide-y divide-line">
              {accounts.map((account) => {
                const hasRelations =
                  account._count.transactions > 0 ||
                  account._count.incomingTransfers > 0 ||
                  account._count.monthlySnapshots > 0;

                return (
                  <li className="grid gap-4 px-4 py-5 sm:px-5" key={account.id}>
                    <div className="grid gap-1 sm:grid-cols-[1fr_auto] sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">
                            {account.name}
                          </h3>
                          {account.isDefault ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                              Por defecto
                            </span>
                          ) : null}
                        </div>
                        <p className="text-sm text-muted">
                          {getAccountTypeLabel(account.type)}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-ink">
                        {currencyFormatter.format(
                          toMoneyNumber(account.currentBalance)
                        )}
                      </p>
                    </div>

                    <form action={updateAccount} className="grid gap-4">
                      <input name="id" type="hidden" value={account.id} />
                      <AccountFields
                        account={{
                          currentBalance: toMoneyNumber(account.currentBalance),
                          includeInAvailableMoney:
                            account.includeInAvailableMoney,
                          includeInMonthlySavings:
                            account.includeInMonthlySavings,
                          includeInNetWorth: account.includeInNetWorth,
                          isDefault: account.isDefault,
                          name: account.name,
                          notes: account.notes,
                          type: account.type
                        }}
                      />
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <button className="primary-button" type="submit">
                          Actualizar
                        </button>
                      </div>
                    </form>

                    <form action={deleteAccount}>
                      <input name="id" type="hidden" value={account.id} />
                      <ConfirmSubmitButton
                        className="danger-button"
                        confirmMessage={`¿Seguro que quieres eliminar la cuenta "${account.name}"? Esta acción no se puede deshacer.`}
                        disabled={hasRelations}
                        title={
                          hasRelations
                            ? "No se puede borrar una cuenta con movimientos"
                            : undefined
                        }
                      >
                        Eliminar cuenta
                      </ConfirmSubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay cuentas.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Crear cuenta</h2>
          <form action={createAccount} className="mt-4 grid gap-4">
            <AccountFields />
            <button className="primary-button" type="submit">
              Guardar cuenta
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

function AccountFields({
  account
}: {
  account?: {
    currentBalance: number;
    includeInAvailableMoney: boolean;
    includeInMonthlySavings: boolean;
    includeInNetWorth: boolean;
    isDefault: boolean;
    name: string;
    notes: string | null;
    type: string;
  };
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="field-label">
          Nombre
          <input
            className="field-input"
            defaultValue={account?.name}
            name="name"
            required
            type="text"
          />
        </label>

        <label className="field-label">
          Tipo
          <select
            className="field-input"
            defaultValue={account?.type ?? "checking"}
            name="type"
          >
            {accountTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          Saldo actual
          <input
            className="field-input"
            defaultValue={account?.currentBalance ?? 0}
            name="currentBalance"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="check-row">
          <input
            defaultChecked={account?.includeInAvailableMoney ?? true}
            name="includeInAvailableMoney"
            type="checkbox"
          />
          Disponible
        </label>
        <label className="check-row">
          <input
            defaultChecked={account?.includeInNetWorth ?? true}
            name="includeInNetWorth"
            type="checkbox"
          />
          Patrimonio
        </label>
        <label className="check-row">
          <input
            defaultChecked={account?.includeInMonthlySavings ?? true}
            name="includeInMonthlySavings"
            type="checkbox"
          />
          Ahorro mensual
        </label>
        <label className="check-row">
          <input
            defaultChecked={account?.isDefault ?? false}
            name="isDefault"
            type="checkbox"
          />
          Por defecto
        </label>
      </div>

      <label className="field-label">
        Notas
        <input
          className="field-input"
          defaultValue={account?.notes ?? ""}
          name="notes"
          type="text"
        />
      </label>
    </>
  );
}

function getAccountTypeLabel(type: string): string {
  return accountTypes.find((accountType) => accountType.value === type)?.label ?? type;
}
