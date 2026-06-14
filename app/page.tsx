import Link from "next/link";
import { createQuickTransaction } from "./actions";
import { QuickTransactionForm } from "./components/QuickTransactionForm";
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

const transactionLabels = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
  balance_adjustment: "Ajuste",
  reimbursable_expense: "Reembolsable",
  reimbursement_income: "Cobro reembolso",
  investment_gain: "Revalorización",
  investment_loss: "Pérdida inversión",
  savings_allocation: "Asignación ahorro",
  savings_withdrawal: "Retirada ahorro"
};

export default async function Home() {
  const [accounts, categories, transactions] = await Promise.all([
    prisma.account.findMany({
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isDefault: true
      }
    }),
    prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        type: true
      }
    }),
    prisma.transaction.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        account: {
          select: {
            name: true
          }
        },
        destinationAccount: {
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
    })
  ]);

  const defaultAccount =
    accounts.find((account) => account.name === "Openbank principal") ??
    accounts.find((account) => account.isDefault) ??
    accounts[0];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Movimientos
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Captura rápida
            </h1>
          </div>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink"
            href="/reimbursements"
          >
            Pendientes de cobrar
          </Link>
        </header>

        {accounts.length > 0 ? (
          <QuickTransactionForm
            accounts={accounts.map(({ id, name }) => ({ id, name }))}
            action={createQuickTransaction}
            categories={categories}
            defaultAccountId={defaultAccount.id}
            today={getTodayInputValue()}
          />
        ) : (
          <section className="rounded-lg border border-line bg-white p-4 text-sm text-muted">
            Ejecuta el seed inicial para crear las cuentas y categorías base.
          </section>
        )}

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Movimientos recientes
            </h2>
          </div>

          {transactions.length > 0 ? (
            <ul className="divide-y divide-line">
              {transactions.map((transaction) => {
                const isOutflow =
                  transaction.type === "expense" ||
                  transaction.type === "reimbursable_expense";
                const isInflow =
                  transaction.type === "income" ||
                  transaction.type === "reimbursement_income";
                const amount = toMoneyNumber(transaction.amount);

                return (
                  <li
                    className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                    key={transaction.id}
                  >
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {transaction.description ||
                            transaction.category?.name ||
                            transactionLabels[transaction.type]}
                        </span>
                        <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                          {transactionLabels[transaction.type]}
                        </span>
                      </div>
                      <p className="text-sm text-muted">
                        {formatMovementRoute(transaction)} ·{" "}
                        {dateFormatter.format(transaction.date)}
                      </p>
                    </div>

                    <p
                      className={`text-lg font-semibold ${
                        isOutflow
                          ? "text-rose-700"
                          : isInflow
                            ? "text-emerald-700"
                            : "text-ink"
                      }`}
                    >
                      {formatMovementAmount(transaction.type, amount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay movimientos registrados.
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

function formatMovementRoute(transaction: {
  account: { name: string };
  destinationAccount: { name: string } | null;
  category: { name: string } | null;
  type: keyof typeof transactionLabels;
}): string {
  if (transaction.type === "transfer" && transaction.destinationAccount) {
    return `${transaction.account.name} -> ${transaction.destinationAccount.name}`;
  }

  return [transaction.account.name, transaction.category?.name]
    .filter(Boolean)
    .join(" · ");
}

function formatMovementAmount(
  type: keyof typeof transactionLabels,
  amount: number
): string {
  if (type === "expense" || type === "reimbursable_expense") {
    return `-${currencyFormatter.format(amount)}`;
  }

  if (type === "income" || type === "reimbursement_income") {
    return `+${currencyFormatter.format(amount)}`;
  }

  return currencyFormatter.format(amount);
}
