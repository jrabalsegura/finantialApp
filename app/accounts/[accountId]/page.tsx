import Link from "next/link";
import { notFound } from "next/navigation";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const accountTypeLabels = {
  cash: "Efectivo",
  checking: "Corriente",
  investment: "Inversión",
  other: "Otra",
  pension: "Plan de pensiones",
  savings: "Ahorro",
  treasury: "Tesoro"
};

const transactionLabels = {
  balance_adjustment: "Ajuste",
  expense: "Gasto",
  income: "Ingreso",
  investment_gain: "Revalorización",
  investment_loss: "Pérdida inversión",
  reimbursable_expense: "Reembolsable",
  reimbursement_income: "Cobro reembolso",
  savings_allocation: "Asignación ahorro",
  savings_withdrawal: "Retirada ahorro",
  transfer: "Transferencia"
};

const currencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR"
});

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

export default async function AccountHistoryPage({
  params
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: {
      currentBalance: true,
      includeInAvailableMoney: true,
      includeInNetWorth: true,
      name: true,
      type: true
    }
  });

  if (!account) {
    notFound();
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [{ accountId }, { destinationAccountId: accountId }]
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
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
      },
      destinationAccount: {
        select: {
          name: true
        }
      },
      savingsBucket: {
        select: {
          name: true
        }
      }
    }
  });

  const realBalanceVariation = transactions.reduce((total, transaction) => {
    if (!transaction.affectsRealBalance) {
      return total;
    }

    return total + getSignedAccountAmount(transaction, accountId);
  }, 0);

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Link className="text-sm font-semibold text-accent" href="/">
              Volver al dashboard
            </Link>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Histórico de cuenta
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              {account.name}
            </h1>
            <p className="text-sm text-muted">{accountTypeLabels[account.type]}</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric
            label="Saldo actual"
            value={toMoneyNumber(account.currentBalance)}
          />
          <Metric
            label="Variación por movimientos"
            value={realBalanceVariation}
          />
          <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-muted">Movimientos</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {transactions.length}
            </p>
            <p className="mt-2 text-xs leading-5 text-muted">
              {[
                account.includeInAvailableMoney ? "Disponible" : null,
                account.includeInNetWorth ? "Patrimonio" : null
              ]
                .filter(Boolean)
                .join(" · ") || "-"}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Movimientos relacionados
            </h2>
          </div>

          {transactions.length > 0 ? (
            <ul className="divide-y divide-line">
              {transactions.map((transaction) => {
                const signedAmount = getSignedAccountAmount(
                  transaction,
                  accountId
                );
                const isPositive = signedAmount > 0;
                const isNegative = signedAmount < 0;

                return (
                  <li
                    className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                    key={transaction.id}
                  >
                    <div className="grid gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-ink">
                          {transaction.description ||
                            transaction.category?.name ||
                            transaction.savingsBucket?.name ||
                            transactionLabels[transaction.type]}
                        </p>
                        <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                          {transactionLabels[transaction.type]}
                        </span>
                        {!transaction.affectsRealBalance ? (
                          <span className="rounded-full bg-surface px-2 py-1 text-xs font-medium text-muted">
                            No cambia saldo real
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted">
                        {formatAccountRoute(transaction)} ·{" "}
                        {dateFormatter.format(transaction.date)}
                      </p>
                    </div>
                    <p
                      className={`text-lg font-semibold ${
                        isPositive
                          ? "text-emerald-700"
                          : isNegative
                            ? "text-rose-700"
                            : "text-ink"
                      }`}
                    >
                      {formatSignedAmount(signedAmount)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay movimientos asociados a esta cuenta.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">
        {currencyFormatter.format(value)}
      </p>
    </div>
  );
}

function formatAccountRoute(transaction: {
  account: { name: string };
  category: { name: string } | null;
  destinationAccount: { name: string } | null;
  savingsBucket: { name: string } | null;
  type: keyof typeof transactionLabels;
}) {
  if (transaction.type === "transfer" && transaction.destinationAccount) {
    return `${transaction.account.name} -> ${transaction.destinationAccount.name}`;
  }

  return [
    transaction.account.name,
    transaction.category?.name,
    transaction.savingsBucket?.name
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatSignedAmount(amount: number): string {
  if (amount > 0) {
    return `+${currencyFormatter.format(amount)}`;
  }

  if (amount < 0) {
    return `-${currencyFormatter.format(Math.abs(amount))}`;
  }

  return currencyFormatter.format(amount);
}

function getSignedAccountAmount(
  transaction: {
    accountId: string;
    amount: { toNumber: () => number } | { toString: () => string } | number | string;
    destinationAccountId: string | null;
    type: keyof typeof transactionLabels;
  },
  accountId: string
): number {
  const amount = toMoneyNumber(transaction.amount);

  if (transaction.type === "transfer") {
    return transaction.destinationAccountId === accountId ? amount : -amount;
  }

  if (
    transaction.type === "expense" ||
    transaction.type === "reimbursable_expense" ||
    transaction.type === "investment_loss"
  ) {
    return -amount;
  }

  if (
    transaction.type === "income" ||
    transaction.type === "reimbursement_income" ||
    transaction.type === "investment_gain"
  ) {
    return amount;
  }

  return 0;
}
