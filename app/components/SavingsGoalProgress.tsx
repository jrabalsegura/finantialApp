import Link from "next/link";
import {
  getBucketGoalProgress,
  type SavingsBucketGoalInput
} from "@/domain/savings-goals";
import { currencyFormatter } from "@/lib/formatters";

type SavingsGoalProgressProps = {
  bucket: SavingsBucketGoalInput & {
    name?: string;
  };
  className?: string;
  compact?: boolean;
  href?: string;
  showName?: boolean;
};

export function SavingsGoalProgress({
  bucket,
  className = "",
  compact = false,
  href,
  showName = false
}: SavingsGoalProgressProps) {
  const progress = getBucketGoalProgress(bucket);
  const content = (
    <div className={`grid min-w-0 gap-2 ${className}`}>
      {showName && bucket.name ? (
        <div className="flex min-w-0 items-start justify-between gap-3">
          <p className="truncate text-sm font-semibold text-ink">
            {bucket.name}
          </p>
          {progress.hasGoal ? (
            <span className="shrink-0 text-xs font-semibold text-muted">
              {formatPercentage(Math.max(progress.percentage ?? 0, 0))}
            </span>
          ) : null}
        </div>
      ) : null}

      {progress.hasGoal && progress.targetAmount != null ? (
        <>
          <div className="grid gap-1">
            <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="amount-text text-sm font-semibold text-ink">
                {currencyFormatter.format(progress.currentAmount)} /{" "}
                {currencyFormatter.format(progress.targetAmount)}
              </p>
              <p className="text-sm font-semibold text-accent">
                {formatPercentage(Math.max(progress.percentage ?? 0, 0))} cubierto
              </p>
            </div>
            {!compact ? (
              <p className="text-xs text-muted">
                {progress.isOverfunded
                  ? `Objetivo completado · Excedente: ${currencyFormatter.format(progress.overfundedAmount)}`
                  : progress.isCompleted
                    ? "Objetivo completado"
                    : `Faltan ${currencyFormatter.format(progress.remainingAmount ?? 0)}`}
              </p>
            ) : (
              <p className="text-xs text-muted">
                {progress.isOverfunded
                  ? `Excedente: ${currencyFormatter.format(progress.overfundedAmount)}`
                  : progress.isCompleted
                    ? "Objetivo completado"
                    : `Faltan ${currencyFormatter.format(progress.remainingAmount ?? 0)}`}
              </p>
            )}
          </div>
          <ProgressBar
            percentage={progress.visualPercentage}
            completed={progress.isCompleted}
          />
        </>
      ) : (
        <div className="grid gap-1">
          <p className="amount-text text-sm font-semibold text-ink">
            {currencyFormatter.format(progress.currentAmount)}
          </p>
          <p className="text-xs text-muted">Sin objetivo configurado</p>
          {!compact ? <ProgressBar percentage={0} disabled /> : null}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link className="block transition hover:bg-surface" href={href}>
        {content}
      </Link>
    );
  }

  return content;
}

export function ProgressBar({
  completed = false,
  disabled = false,
  percentage
}: {
  completed?: boolean;
  disabled?: boolean;
  percentage: number;
}) {
  const width = `${Math.min(Math.max(percentage, 0), 100)}%`;

  return (
    <div
      aria-hidden="true"
      className={`h-2 overflow-hidden rounded-full ${
        disabled ? "bg-line" : "bg-surface"
      }`}
    >
      <div
        className={`h-full rounded-full ${
          disabled
            ? "bg-line"
            : completed
              ? "bg-emerald-600"
              : "bg-accent"
        }`}
        style={{
          minWidth: percentage > 0 ? "0.25rem" : undefined,
          width
        }}
      />
    </div>
  );
}

function formatPercentage(value: number): string {
  return `${new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: value >= 100 ? 2 : 1,
    minimumFractionDigits: 0
  }).format(value)}%`;
}
