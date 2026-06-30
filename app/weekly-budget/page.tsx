import Link from "next/link";
import { WeeklyBudgetCard } from "../components/WeeklyBudgetCard";
import {
  currencyFormatter,
  dayMonthFormatter as dateFormatter
} from "@/lib/formatters";
import { getWeeklyBudgetReport } from "@/lib/weekly-budget";

export const dynamic = "force-dynamic";

export default async function WeeklyBudgetPage() {
  const report = await getWeeklyBudgetReport();
  const { setting, status } = report;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Objetivo semanal
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Detalle del gasto disponible
            </h1>
            <p className="text-sm text-muted">
              Semana del {dateFormatter.format(status.weekStart)} al{" "}
              {dateFormatter.format(status.weekEnd)}
            </p>
          </div>
        </header>

        <WeeklyBudgetCard status={status} />

        {!status.hasSufficientConfiguration ? (
          <section className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950">
            <h2 className="font-semibold">Faltan ingresos fijos</h2>
            <p className="mt-1 text-sm leading-6">
              Crea al menos un movimiento recurrente mensual activo de tipo
              ingreso. Los importes se consideran aunque su fecha prevista aún
              no haya llegado.
            </p>
            <Link
              className="mt-4 inline-flex text-sm font-semibold underline"
              href="/recurring"
            >
              Configurar movimientos fijos
            </Link>
          </section>
        ) : null}

        {status.monthlyVariableBudget < 0 ? (
          <section className="rounded-lg border border-rose-300 bg-rose-50 p-5 text-rose-950">
            <h2 className="font-semibold">Presupuesto variable negativo</h2>
            <p className="mt-1 text-sm leading-6">
              Los gastos fijos y el ahorro mínimo superan los ingresos fijos en{" "}
              {currencyFormatter.format(
                Math.abs(status.monthlyVariableBudget)
              )}
              . Revisa los recurrentes o el objetivo mensual.
            </p>
          </section>
        ) : null}

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Desglose del cálculo
            </h2>
            <p className="mt-1 text-xs text-muted">
              Modo:{" "}
              {setting.calculationMode === "remaining_days"
                ? "días restantes"
                : "mes completo proporcional"}
            </p>
          </div>
          <dl className="grid sm:grid-cols-2">
            <DetailRow
              label="Ingresos fijos mensuales"
              value={status.fixedMonthlyIncome}
            />
            <DetailRow
              label="Gastos fijos mensuales"
              value={status.fixedMonthlyExpenses}
            />
            <DetailRow
              label="Ahorro mínimo objetivo"
              note={setting.savingsBucket?.name ?? "Sin partida asociada"}
              value={status.monthlyMinimumSavingsTarget}
            />
            <DetailRow
              label="Presupuesto variable mensual"
              value={status.monthlyVariableBudget}
            />
            <DetailRow
              label="Gasto variable acumulado del mes"
              value={status.monthlyVariableExpense}
            />
            <DetailRow
              label="Transferido a cuentas no disponibles"
              note="No es gasto personal, pero deja de estar disponible para gastar."
              value={status.monthlyTransferredOutOfAvailable}
            />
            <DetailRow
              label="Presupuesto variable restante"
              value={status.remainingVariableBudget}
            />
            <DetailRow
              label="Días restantes del mes"
              textValue={String(status.remainingDaysInMonth)}
            />
            <DetailRow
              label="Días base de la semana"
              note="Se fijan al iniciar la semana."
              textValue={String(status.weeklyAllocationRemainingDaysInMonth)}
            />
            <DetailRow
              label="Disponible diario base"
              value={status.dailyAvailableBudget}
            />
            <DetailRow
              label="Disponible para esta semana"
              note={`${status.daysInCurrentWeekWithinMonth} días asignados dentro del mes`}
              value={status.currentWeekAvailableBudget}
            />
            <DetailRow
              label="Gasto variable de la semana"
              value={status.currentWeekVariableExpense}
            />
            <DetailRow
              label="Transferido fuera de disponible esta semana"
              note="Ya está descontado del disponible semanal; no se suma al gasto personal."
              value={status.currentWeekTransferredOutOfAvailable}
            />
            <DetailRow
              label="Fuera del gasto semanal, pero reduce disponible"
              note="No cuenta como gasto ordinario de la semana; sí ajusta el dinero disponible."
              value={status.currentWeekBudgetAdjustment}
            />
            <DetailRow
              label="Diferencia semanal"
              value={status.currentWeekDifference}
            />
          </dl>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <FixedItems
            emptyText="No hay ingresos recurrentes activos este mes."
            items={report.fixedIncomeItems}
            title="Ingresos fijos considerados"
          />
          <FixedItems
            emptyText="No hay gastos recurrentes activos este mes."
            items={report.fixedExpenseItems}
            title="Gastos fijos considerados"
          />
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Ajustes que reducen el disponible semanal
            </h2>
            <p className="mt-1 text-xs text-muted">
              Gastos que no se miden contra el objetivo semanal ordinario, pero
              sí dejan menos margen esta semana y en el mes.
            </p>
          </div>
          {report.budgetAdjustingExpensesForWeek.length > 0 ? (
            <ul className="divide-y divide-line">
              {report.budgetAdjustingExpensesForWeek.map((transaction) => (
                <li
                  className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                  key={transaction.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {transaction.description}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {transaction.accountName}
                      {transaction.categoryName
                        ? ` · ${transaction.categoryName}`
                        : ""}
                      {" · "}
                      {dateFormatter.format(transaction.date)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-amber-700">
                    {currencyFormatter.format(transaction.amount)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay ajustes de este tipo en la semana actual.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Gastos variables incluidos esta semana
            </h2>
            <p className="mt-1 text-xs text-muted">
              Excluye fijos recurrentes, transferencias, reembolsos,
              inversiones, ajustes y asignaciones de ahorro.
            </p>
          </div>
          {report.variableExpensesForWeek.length > 0 ? (
            <ul className="divide-y divide-line">
              {report.variableExpensesForWeek.map((transaction) => (
                <li
                  className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                  key={transaction.id}
                >
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {transaction.description}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {transaction.accountName}
                      {transaction.categoryName
                        ? ` · ${transaction.categoryName}`
                        : ""}
                      {" · "}
                      {dateFormatter.format(transaction.date)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-rose-700">
                    {currencyFormatter.format(transaction.amount)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay gastos variables incluidos en la semana actual.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-4 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Transferencias que reducen el disponible
            </h2>
            <p className="mt-1 text-xs text-muted">
              Solo se incluyen salidas desde una cuenta disponible hacia una
              cuenta no disponible. No cuentan como gasto personal; una
              transferencia interna entre cuentas patrimoniales tampoco altera
              el patrimonio total.
            </p>
          </div>
          {report.availabilityReducingTransfersForWeek.length > 0 ? (
            <ul className="divide-y divide-line">
              {report.availabilityReducingTransfersForWeek.map(
                (transaction) => (
                  <li
                    className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                    key={transaction.id}
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {transaction.description}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {transaction.accountName} →{" "}
                        {transaction.destinationAccountName} ·{" "}
                        {dateFormatter.format(transaction.date)}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-amber-700">
                      {currencyFormatter.format(transaction.amount)}
                    </p>
                  </li>
                )
              )}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay transferencias de este tipo en la semana actual.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DetailRow({
  label,
  note,
  textValue,
  value
}: {
  label: string;
  note?: string;
  textValue?: string;
  value?: number;
}) {
  return (
    <div className="border-b border-line px-4 py-4 sm:border-r sm:px-5">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-ink">
        {textValue ?? currencyFormatter.format(value ?? 0)}
      </dd>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function FixedItems({
  emptyText,
  items,
  title
}: {
  emptyText: string;
  items: Array<{
    id: string;
    name: string;
    amount: number;
    amountPerOccurrence: number;
    frequency: "monthly" | "weekly";
    dayOfMonth: number;
    dayOfWeek: number;
    occurrenceCount: number;
    accountName: string;
    categoryName: string | null;
  }>;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li
              className="grid grid-cols-[1fr_auto] gap-3 px-4 py-4 sm:px-5"
              key={item.id}
            >
              <div>
                <p className="text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-1 text-xs text-muted">
                  {item.frequency === "weekly"
                    ? `${item.occurrenceCount} semanas × ${currencyFormatter.format(
                        item.amountPerOccurrence
                      )}`
                    : `Día ${item.dayOfMonth}`}
                  {" · "}
                  {item.accountName}
                  {item.categoryName ? ` · ${item.categoryName}` : ""}
                </p>
              </div>
              <p className="text-sm font-semibold text-ink">
                {currencyFormatter.format(item.amount)}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8 text-sm text-muted sm:px-5">{emptyText}</div>
      )}
    </section>
  );
}
