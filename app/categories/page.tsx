import Link from "next/link";
import type { CategoryType } from "@prisma/client";
import { ConfirmSubmitButton } from "../components/ConfirmSubmitButton";
import {
  createCategory,
  deleteCategory,
  updateCategory
} from "./actions";
import { calculateCategoryTotals } from "@/domain/dashboard";
import { getMonthDateRange } from "@/domain/financial-calculations";
import {
  currencyFormatter,
  monthYearFormatter as monthFormatter
} from "@/lib/formatters";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type CategoryReportType = "expense" | "income";

const categoryTypeLabels: Record<CategoryType, string> = {
  both: "Gastos e ingresos",
  expense: "Gastos",
  income: "Ingresos"
};

export default async function CategoriesPage({
  searchParams
}: {
  searchParams: Promise<{
    period?: string;
    type?: string;
  }>;
}) {
  const query = await searchParams;
  const today = new Date();
  const selectedPeriod = parsePeriod(query.period, today);
  const reportType = parseReportType(query.type);
  const monthRange = getMonthDateRange(selectedPeriod.year, selectedPeriod.month);

  const [categories, transactions] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
      include: {
        _count: {
          select: {
            quickTransactionTemplates: true,
            recurringTransactions: true,
            transactions: true
          }
        }
      }
    }),
    prisma.transaction.findMany({
      where: {
        date: {
          gte: monthRange.start,
          lt: monthRange.end
        }
      },
      select: {
        affectsPersonalExpense: true,
        affectsPersonalIncome: true,
        amount: true,
        category: { select: { id: true, name: true } },
        categoryId: true,
        date: true
      }
    })
  ]);

  const categoryTotals = calculateCategoryTotals({
    month: selectedPeriod.month,
    transactions,
    type: reportType,
    year: selectedPeriod.year
  });
  const total = categoryTotals.reduce((sum, item) => sum + item.value, 0);
  const monthLabel = capitalize(
    monthFormatter.format(
      new Date(selectedPeriod.year, selectedPeriod.month - 1, 1)
    )
  );

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <header className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-accent">
              Categorías
            </p>
            <h1 className="text-3xl font-semibold text-ink sm:text-4xl">
              Gastos e ingresos por categoría
            </h1>
            <p className="text-sm text-muted">{monthLabel}</p>
          </div>
        </header>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <form className="grid gap-4 sm:grid-cols-[220px_220px_auto]" method="GET">
            <label className="field-label">
              Mes
              <input
                className="field-input"
                defaultValue={formatPeriodValue(selectedPeriod)}
                name="period"
                type="month"
              />
            </label>
            <label className="field-label">
              Vista
              <select className="field-input" defaultValue={reportType} name="type">
                <option value="expense">Gastos</option>
                <option value="income">Ingresos</option>
              </select>
            </label>
            <button className="primary-button self-end" type="submit">
              Filtrar
            </button>
          </form>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric
            label={reportType === "expense" ? "Gastos categorizados" : "Ingresos categorizados"}
            value={currencyFormatter.format(total)}
          />
          <Metric
            label="Categorías con movimiento"
            value={String(categoryTotals.length)}
          />
          <Metric label="Categorías creadas" value={String(categories.length)} />
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Distribución del mes
            </h2>
          </div>
          {categoryTotals.length > 0 ? (
            <ul className="divide-y divide-line">
              {categoryTotals.map((item) => {
                const percentage = total > 0 ? item.value / total : 0;

                return (
                  <li key={item.categoryId}>
                    <Link
                      className="grid gap-2 px-4 py-4 transition hover:bg-surface sm:px-5"
                      href={buildCategoryHref({
                        categoryId: item.categoryId,
                        period: selectedPeriod,
                        type: reportType
                      })}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">
                            {item.name}
                          </p>
                          <p className="text-xs text-muted">
                            {item.count}{" "}
                            {item.count === 1 ? "movimiento" : "movimientos"}
                          </p>
                        </div>
                        <p className="amount-text shrink-0 text-right text-sm font-semibold text-ink">
                          {currencyFormatter.format(item.value)}
                        </p>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface">
                        <div
                          className={`h-full rounded-full ${
                            reportType === "expense"
                              ? "bg-rose-600"
                              : "bg-emerald-600"
                          }`}
                          style={{ width: `${Math.round(percentage * 100)}%` }}
                        />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              No hay movimientos categorizados para este filtro.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-line bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-semibold text-ink">Crear categoría</h2>
          <form action={createCategory} className="mt-4 grid gap-4 lg:grid-cols-5">
            <CategoryFields />
            <button className="primary-button lg:col-span-2" type="submit">
              Guardar categoría
            </button>
          </form>
        </section>

        <section className="rounded-lg border border-line bg-white shadow-sm">
          <div className="border-b border-line px-4 py-3 sm:px-5">
            <h2 className="text-lg font-semibold text-ink">
              Categorías existentes
            </h2>
          </div>
          {categories.length > 0 ? (
            <ul className="divide-y divide-line">
              {categories.map((category) => {
                const relationCount =
                  category._count.transactions +
                  category._count.recurringTransactions +
                  category._count.quickTransactionTemplates;

                return (
                  <li className="grid gap-4 px-4 py-4 sm:px-5" key={category.id}>
                    <form
                      action={updateCategory}
                      className="grid gap-4 lg:grid-cols-5"
                    >
                      <input name="id" type="hidden" value={category.id} />
                      <CategoryFields category={category} />
                      <button className="primary-button lg:col-span-2" type="submit">
                        Actualizar categoría
                      </button>
                    </form>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-muted">
                        {categoryTypeLabels[category.type]} ·{" "}
                        {relationCount} referencias
                      </p>
                      <form action={deleteCategory}>
                        <input name="id" type="hidden" value={category.id} />
                        <ConfirmSubmitButton
                          className="danger-button"
                          confirmMessage={`¿Eliminar la categoría "${category.name}"?`}
                          disabled={relationCount > 0}
                          title={
                            relationCount > 0
                              ? "No se puede borrar una categoría en uso"
                              : undefined
                          }
                        >
                          Eliminar categoría
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 py-8 text-sm text-muted sm:px-5">
              Todavía no hay categorías creadas.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function CategoryFields({
  category
}: {
  category?: {
    color: string | null;
    icon: string | null;
    name: string;
    type: CategoryType;
  };
}) {
  return (
    <>
      <label className="field-label lg:col-span-2">
        Nombre
        <input
          className="field-input"
          defaultValue={category?.name}
          name="name"
          required
          type="text"
        />
      </label>
      <label className="field-label">
        Tipo
        <select
          className="field-input"
          defaultValue={category?.type ?? "expense"}
          name="type"
        >
          <option value="expense">Gastos</option>
          <option value="income">Ingresos</option>
          <option value="both">Ambos</option>
        </select>
      </label>
      <label className="field-label">
        Icono
        <input
          className="field-input"
          defaultValue={category?.icon ?? ""}
          name="icon"
          type="text"
        />
      </label>
      <label className="field-label">
        Color
        <input
          className="field-input"
          defaultValue={category?.color ?? ""}
          name="color"
          placeholder="#2563eb"
          type="text"
        />
      </label>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="amount-text mt-2 text-2xl font-semibold text-ink">
        {value}
      </p>
    </div>
  );
}

function buildCategoryHref({
  categoryId,
  period,
  type
}: {
  categoryId: string;
  period: { month: number; year: number };
  type: CategoryReportType;
}): string {
  const params = new URLSearchParams({
    month: String(period.month),
    type,
    year: String(period.year)
  });

  return `/categories/${encodeURIComponent(categoryId)}?${params.toString()}`;
}

function parsePeriod(
  value: string | undefined,
  fallback: Date
): { month: number; year: number } {
  if (value) {
    const [yearValue, monthValue] = value.split("-");
    const year = Number(yearValue);
    const month = Number(monthValue);

    if (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      year >= 2000 &&
      year <= 2100 &&
      month >= 1 &&
      month <= 12
    ) {
      return { month, year };
    }
  }

  return {
    month: fallback.getMonth() + 1,
    year: fallback.getFullYear()
  };
}

function parseReportType(value: string | undefined): CategoryReportType {
  return value === "income" ? "income" : "expense";
}

function formatPeriodValue(period: { month: number; year: number }): string {
  return `${period.year}-${String(period.month).padStart(2, "0")}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
