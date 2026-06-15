import Link from "next/link";
import type { CategoryTotal } from "@/domain/dashboard";
import { currencyFormatter } from "@/lib/formatters";

export function MetricCard({
  helper,
  label,
  tone,
  value
}: {
  helper: string;
  label: string;
  tone?: "positive" | "negative";
  value: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          tone === "positive"
            ? "text-emerald-700"
            : tone === "negative"
              ? "text-rose-700"
              : "text-ink"
        }`}
      >
        {currencyFormatter.format(value)}
      </p>
      <p className="mt-2 text-xs leading-5 text-muted">{helper}</p>
    </div>
  );
}

export function NetWorthVariationCard({
  variation
}: {
  variation:
    | {
        amount: number;
        label: string;
      }
    | null;
}) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-muted">Variación patrimonial</p>
      {variation ? (
        <>
          <p
            className={`mt-2 text-2xl font-semibold ${
              variation.amount >= 0 ? "text-emerald-700" : "text-rose-700"
            }`}
          >
            {currencyFormatter.format(variation.amount)}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted">
            {variation.label}. Incluye ahorro, aportaciones, revalorizaciones y
            pérdidas.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-2xl font-semibold text-ink">Sin cierres</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            Se calculará cuando existan al menos dos cierres mensuales. Es una
            métrica separada del ahorro mensual.
          </p>
          <Link
            className="mt-3 inline-flex text-sm font-semibold text-accent"
            href="/monthly-close"
          >
            Ir al cierre mensual
          </Link>
        </>
      )}
    </div>
  );
}

export function DistributionPanel({
  emptyText,
  items,
  title
}: {
  emptyText: string;
  items: Array<{
    detail: string;
    href?: string;
    id: string;
    label: string;
    value: number;
  }>;
  title: string;
}) {
  const positiveTotal = items.reduce(
    (total, item) => total + Math.max(item.value, 0),
    0
  );

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const percentage =
              positiveTotal > 0 ? Math.max(item.value, 0) / positiveTotal : 0;

            return (
              <li key={item.id}>
                <DistributionPanelItem item={item} percentage={percentage} />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-8 text-sm text-muted sm:px-5">{emptyText}</div>
      )}
    </section>
  );
}

export function CategoryBreakdownPanel({
  emptyText,
  items,
  month,
  title,
  tone,
  year
}: {
  emptyText: string;
  items: CategoryTotal[];
  month: number;
  title: string;
  tone: "expense" | "income";
  year: number;
}) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  const barColor = tone === "income" ? "bg-emerald-600" : "bg-rose-600";
  const amountColor = tone === "income" ? "text-emerald-700" : "text-rose-700";

  return (
    <section className="rounded-lg border border-line bg-white shadow-sm">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y divide-line">
          {items.map((item) => {
            const percentage = total > 0 ? item.value / total : 0;

            return (
              <li key={item.categoryId}>
                <Link
                  className="grid gap-2 px-4 py-4 transition hover:bg-surface sm:px-5"
                  href={buildCategoryDetailHref({
                    categoryId: item.categoryId,
                    month,
                    type: tone,
                    year
                  })}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted">
                        {item.count}{" "}
                        {item.count === 1 ? "movimiento" : "movimientos"}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${amountColor}`}>
                      {currencyFormatter.format(item.value)}
                    </p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.round(percentage * 100)}%` }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-4 py-8 text-sm text-muted sm:px-5">{emptyText}</div>
      )}
    </section>
  );
}

function DistributionPanelItem({
  item,
  percentage
}: {
  item: {
    detail: string;
    href?: string;
    label: string;
    value: number;
  };
  percentage: number;
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{item.label}</p>
          <p className="text-xs text-muted">{item.detail || "-"}</p>
        </div>
        <p className="text-sm font-semibold text-ink">
          {currencyFormatter.format(item.value)}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.round(percentage * 100)}%` }}
        />
      </div>
    </>
  );

  if (item.href) {
    return (
      <Link
        className="grid gap-2 px-4 py-4 transition hover:bg-surface sm:px-5"
        href={item.href}
      >
        {content}
      </Link>
    );
  }

  return <div className="grid gap-2 px-4 py-4 sm:px-5">{content}</div>;
}

function buildCategoryDetailHref({
  categoryId,
  month,
  type,
  year
}: {
  categoryId: string;
  month: number;
  type: "expense" | "income";
  year: number;
}): string {
  const params = new URLSearchParams({
    month: String(month),
    type,
    year: String(year)
  });

  return `/categories/${encodeURIComponent(categoryId)}?${params.toString()}`;
}
