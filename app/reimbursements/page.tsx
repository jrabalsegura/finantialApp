import Link from "next/link";
import {
  convertReimbursementToRealExpense,
  createReimbursableExpense,
  recordReimbursementPayment
} from "../actions";
import { prisma } from "@/lib/prisma";
import { toMoneyNumber } from "@/domain/financial-calculations";

export const dynamic = "force-dynamic";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

const statusLabels = {
  pending: "Pendiente",
  partially_paid: "Parcial",
  paid: "Cobrado",
  cancelled: "Cancelado",
  uncollectible: "Gasto real"
};

export default async function ReimbursementsPage() {
  const [accounts, categories, reimbursements] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true
      }
    }),
    prisma.category.findMany({
      where: {
        type: {
          in: ["expense", "both"]
        }
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.reimbursement.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        originalTransaction: {
          include: {
            account: {
              select: {
                name: true
              }
            },
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    })
  ]);

  const defaultAccount =
    accounts.find((account) => account.name === "Openbank principal") ??
    accounts.find((account) => account.isDefault) ??
    accounts[0];
  const today = getTodayInputValue();

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Pendientes
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Pendientes de cobrar
            </h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            <Link className="nav-link" href="/">
              Movimientos
            </Link>
            <Link className="nav-link" href="/accounts">
              Cuentas
            </Link>
            <Link className="nav-link" href="/savings">
              Partidas
            </Link>
          </nav>
        </header>

        {accounts.length > 0 ? (
          <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-ink">
              Añadir gasto reembolsable
            </h2>
            <form action={createReimbursableExpense} className="mt-4 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-ink">
                  Concepto
                  <input
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    name="title"
                    required
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-ink">
                  Persona
                  <input
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    name="personName"
                    required
                    type="text"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium text-ink">
                  Importe
                  <input
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    inputMode="decimal"
                    min="0.01"
                    name="amount"
                    placeholder="0,00"
                    required
                    step="0.01"
                    type="number"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-ink">
                  Fecha
                  <input
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    defaultValue={today}
                    name="date"
                    required
                    type="date"
                  />
                </label>

                <label className="grid gap-2 text-sm font-medium text-ink">
                  Vencimiento
                  <input
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    name="dueDate"
                    type="date"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-ink">
                  Cuenta
                  <select
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    defaultValue={defaultAccount.id}
                    name="accountId"
                    required
                  >
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 text-sm font-medium text-ink">
                  Categoría
                  <select
                    className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                    name="categoryId"
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium text-ink">
                Notas
                <input
                  className="h-12 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-accent"
                  name="notes"
                  type="text"
                />
              </label>

              <button
                className="min-h-14 rounded-lg bg-ink px-5 py-3 text-base font-semibold text-white"
                type="submit"
              >
                Guardar reembolsable
              </button>
            </form>
          </section>
        ) : (
          <section className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
            Ejecuta el seed inicial para crear las cuentas base.
          </section>
        )}

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">Cobros pendientes</h2>
          </div>

          {reimbursements.length > 0 ? (
            <ul className="divide-y divide-line">
              {reimbursements.map((reimbursement) => {
                const expectedAmount = toMoneyNumber(
                  reimbursement.expectedAmount
                );
                const paidAmount = toMoneyNumber(reimbursement.paidAmount);
                const pendingAmount = Math.max(expectedAmount - paidAmount, 0);
                const isOpen =
                  reimbursement.status === "pending" ||
                  reimbursement.status === "partially_paid";

                return (
                  <li className="grid gap-4 px-4 py-4 sm:px-5" key={reimbursement.id}>
                    <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <div className="grid gap-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">
                            {reimbursement.title}
                          </h3>
                          <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                            {statusLabels[reimbursement.status]}
                          </span>
                        </div>
                        <p className="text-sm text-muted">
                          {reimbursement.personName} ·{" "}
                          {reimbursement.originalTransaction.account.name}
                          {reimbursement.originalTransaction.category
                            ? ` · ${reimbursement.originalTransaction.category.name}`
                            : ""}
                        </p>
                        <p className="text-sm text-muted">
                          {dateFormatter.format(
                            reimbursement.originalTransaction.date
                          )}
                          {reimbursement.dueDate
                            ? ` · Vence ${dateFormatter.format(
                                reimbursement.dueDate
                              )}`
                            : ""}
                        </p>
                      </div>

                      <div className="grid gap-1 text-left sm:text-right">
                        <p className="text-lg font-semibold text-ink">
                          {currencyFormatter.format(pendingAmount)}
                        </p>
                        <p className="text-sm text-muted">
                          {currencyFormatter.format(paidAmount)} cobrados de{" "}
                          {currencyFormatter.format(expectedAmount)}
                        </p>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                        <form
                          action={recordReimbursementPayment}
                          className="grid gap-3 rounded-lg border border-line bg-surface p-3"
                        >
                          <input
                            name="reimbursementId"
                            type="hidden"
                            value={reimbursement.id}
                          />
                          <input name="date" type="hidden" value={today} />
                          <input
                            name="amount"
                            type="hidden"
                            value={pendingAmount}
                          />
                          <label className="grid gap-2 text-sm font-medium text-ink">
                            Cuenta de cobro
                            <select
                              className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                              defaultValue={
                                reimbursement.originalTransaction.accountId
                              }
                              name="accountId"
                            >
                              {accounts.map((account) => (
                                <option key={account.id} value={account.id}>
                                  {account.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            className="min-h-11 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white"
                            type="submit"
                          >
                            Cobrar total
                          </button>
                        </form>

                        <form
                          action={recordReimbursementPayment}
                          className="grid gap-3 rounded-lg border border-line bg-surface p-3"
                        >
                          <input
                            name="reimbursementId"
                            type="hidden"
                            value={reimbursement.id}
                          />
                          <input name="date" type="hidden" value={today} />
                          <div className="grid grid-cols-2 gap-3">
                            <label className="grid gap-2 text-sm font-medium text-ink">
                              Importe
                              <input
                                className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                                inputMode="decimal"
                                max={pendingAmount}
                                min="0.01"
                                name="amount"
                                required
                                step="0.01"
                                type="number"
                              />
                            </label>
                            <label className="grid gap-2 text-sm font-medium text-ink">
                              Cuenta
                              <select
                                className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent"
                                defaultValue={
                                  reimbursement.originalTransaction.accountId
                                }
                                name="accountId"
                              >
                                {accounts.map((account) => (
                                  <option key={account.id} value={account.id}>
                                    {account.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <button
                            className="min-h-11 rounded-lg border border-emerald-700 px-4 text-sm font-semibold text-emerald-800"
                            type="submit"
                          >
                            Cobro parcial
                          </button>
                        </form>

                        <form action={convertReimbursementToRealExpense}>
                          <input
                            name="reimbursementId"
                            type="hidden"
                            value={reimbursement.id}
                          />
                          <button
                            className="min-h-11 w-full rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-800 sm:h-full"
                            type="submit"
                          >
                            Convertir en gasto real
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay pendientes de cobrar.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function getTodayInputValue(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
