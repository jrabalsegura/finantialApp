import Link from "next/link";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { getOrCreateBudgetSetting } from "@/lib/weekly-budget";
import { prisma } from "@/lib/prisma";
import { updateBudgetSetting } from "./actions";

export const dynamic = "force-dynamic";

export default async function BudgetSettingsPage() {
  const [setting, savingsBuckets] = await Promise.all([
    getOrCreateBudgetSetting(),
    prisma.savingsBucket.findMany({
      orderBy: [{ priority: "asc" }, { name: "asc" }],
      select: { id: true, name: true }
    })
  ]);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-3xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Configuración
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Objetivo semanal
            </h1>
            <p className="text-sm text-muted">
              Define el ahorro mínimo que debe quedar protegido antes de
              calcular tu gasto variable.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Dashboard
            </Link>
            <Link className="nav-link" href="/weekly-budget">
              Ver detalle
            </Link>
            <Link className="nav-link" href="/settings/backup">
              Backup
            </Link>
          </nav>
        </header>

        <form
          action={updateBudgetSetting}
          className="grid gap-5 rounded-lg border border-line bg-white p-4 shadow-sm sm:p-6"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              Ahorro mínimo mensual
              <input
                className="field-input"
                defaultValue={toMoneyNumber(
                  setting.monthlyMinimumSavingsTarget
                )}
                min="0"
                name="monthlyMinimumSavingsTarget"
                required
                step="0.01"
                type="number"
              />
              <span className="text-xs font-normal leading-5 text-muted">
                Se resta de los ingresos fijos junto con los gastos fijos.
              </span>
            </label>

            <label className="field-label">
              Partida de ahorro asociada
              <select
                className="field-input"
                defaultValue={setting.savingsBucketId ?? ""}
                name="savingsBucketId"
              >
                <option value="">Sin partida asociada</option>
                {savingsBuckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </option>
                ))}
              </select>
              <span className="text-xs font-normal leading-5 text-muted">
                Es una referencia informativa; no crea asignaciones
                automáticamente.
              </span>
            </label>
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-semibold text-ink">
              Modo de cálculo
            </legend>
            <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
              <input
                defaultChecked={setting.calculationMode === "remaining_days"}
                className="mt-1"
                name="calculationMode"
                type="radio"
                value="remaining_days"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Días restantes
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Reparte lo que queda del presupuesto entre hoy y el final del
                  mes.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
              <input
                defaultChecked={
                  setting.calculationMode === "full_month_proportional"
                }
                className="mt-1"
                name="calculationMode"
                type="radio"
                value="full_month_proportional"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">
                  Mes completo proporcional
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted">
                  Usa una cantidad diaria fija basada en todos los días del
                  mes.
                </span>
              </span>
            </label>
          </fieldset>

          <div className="grid gap-3">
            <label className="check-row min-h-14">
              <input
                defaultChecked={setting.includePendingTransactions}
                name="includePendingTransactions"
                type="checkbox"
              />
              Incluir movimientos pendientes
            </label>
            <label className="check-row min-h-14">
              <input
                defaultChecked={setting.includeReimbursableExpenses}
                name="includeReimbursableExpenses"
                type="checkbox"
              />
              Incluir gastos reembolsables
            </label>
            <p className="text-xs leading-5 text-muted">
              Por defecto ambos quedan fuera. Los movimientos pendientes solo
              se aplicarán cuando exista ese estado en el registro de
              transacciones.
            </p>
          </div>

          <button className="primary-button w-full sm:w-fit" type="submit">
            Guardar configuración
          </button>
        </form>
      </div>
    </main>
  );
}
