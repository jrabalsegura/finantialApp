import Link from "next/link";
import { notFound } from "next/navigation";
import { getMonthDateRange, toMoneyNumber } from "@/domain/financial-calculations";
import {
  currencyFormatter,
  monthYearFormatter as monthFormatter,
  shortDateFormatter as dateFormatter
} from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const uncategorizedCategoryId = "sin-categoria";

type TransactionKind = "expense" | "income";

export default async function CategoryMonthPage({
  params,
  searchParams
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{
    month?: string;
    type?: string;
    year?: string;
  }>;
}) {
  const [{ categoryId }, query] = await Promise.all([params, searchParams]);
  const today = new Date();
  const year = parseYear(query.year, today.getFullYear());
  const month = parseMonth(query.month, today.getMonth() + 1);
  const type = parseTransactionKind(query.type);
  const monthRange = getMonthDateRange(year, month);
  const isUncategorized = categoryId === uncategorizedCategoryId;

  const category = isUncategorized
    ? null
    : await prisma.category.findUnique({
        where: { id: categoryId },
        select: {
          id: true,
          name: true,
          type: true
        }
      });

  if (!isUncategorized && !category) {
    notFound();
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      categoryId: isUncategorized ? null : categoryId,
      date: {
        gte: monthRange.start,
        lt: monthRange.end
      },
      ...(type === "expense"
        ? { affectsPersonalExpense: true }
        : { affectsPersonalIncome: true })
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      account: {
        select: {
          name: true
        }
      }
    }
  });

  const total = transactions.reduce(
    (sum, transaction) => sum + toMoneyNumber(transaction.amount),
    0
  );
  const categoryName = category?.name ?? "Sin categoría";
  const typeLabel = type === "expense" ? "Gastos" : "Ingresos";
  const monthLabel = capitalize(
    monthFormatter.format(new Date(year, month - 1, 1))
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <Link className="text-sm font-semibold text-accent" href="/">
              Volver al dashboard
            </Link>
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              {typeLabel} por categoría
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              {categoryName}
            </h1>
            <p className="text-sm text-muted">{monthLabel}</p>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-muted">Total del mes</p>
            <p
              className={`mt-2 text-3xl font-semibold ${
                type === "expense" ? "text-rose-700" : "text-emerald-700"
              }`}
            >
              {currencyFormatter.format(total)}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-muted">Movimientos</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {transactions.length}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Detalle de movimientos
            </h2>
          </div>

          {transactions.length > 0 ? (
            <ul className="divide-y divide-line">
              {transactions.map((transaction) => (
                <li
                  className="grid gap-2 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5"
                  key={transaction.id}
                >
                  <div className="grid gap-1">
                    <p className="text-sm font-semibold text-ink">
                      {transaction.description || categoryName}
                    </p>
                    <p className="text-sm text-muted">
                      {transaction.account.name} ·{" "}
                      {dateFormatter.format(transaction.date)}
                    </p>
                  </div>
                  <p
                    className={`text-lg font-semibold ${
                      type === "expense" ? "text-rose-700" : "text-emerald-700"
                    }`}
                  >
                    {type === "expense" ? "-" : "+"}
                    {currencyFormatter.format(toMoneyNumber(transaction.amount))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay movimientos para esta categoría en el mes seleccionado.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function parseMonth(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return fallback;
  }

  return parsed;
}

function parseTransactionKind(value: string | undefined): TransactionKind {
  return value === "income" ? "income" : "expense";
}

function parseYear(value: string | undefined, fallback: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    return fallback;
  }

  return parsed;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
