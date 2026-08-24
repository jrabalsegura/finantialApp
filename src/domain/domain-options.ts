import type {
  AccountType,
  QuickTransactionTemplateType,
  RecurringOccurrenceStatus,
  RecurringTransactionType,
  ReimbursementStatus,
  TransactionType,
  WeeklyBudgetImpactScope
} from "@prisma/client";

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "cash",
  "investment",
  "pension",
  "treasury",
  "other"
] as const satisfies ReadonlyArray<AccountType>;

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Corriente",
  savings: "Ahorro",
  cash: "Efectivo",
  investment: "Inversión",
  pension: "Plan de pensiones",
  treasury: "Tesoro",
  other: "Otra"
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map((value) => ({
  value,
  label: ACCOUNT_TYPE_LABELS[value]
}));

export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
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

export const QUICK_TRANSACTION_TYPES = [
  "expense",
  "income",
  "transfer",
  "reimbursable_expense",
  "reimbursement_income",
  "savings_allocation"
] as const satisfies ReadonlyArray<QuickTransactionTemplateType>;

export const QUICK_TRANSACTION_TYPE_LABELS: Record<
  QuickTransactionTemplateType,
  string
> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
  reimbursable_expense: "Gasto reembolsable",
  reimbursement_income: "Cobro de reembolso",
  savings_allocation: "Asignación a ahorro"
};

export const QUICK_TRANSACTION_TYPE_OPTIONS = QUICK_TRANSACTION_TYPES.map(
  (value) => ({
    value,
    label: QUICK_TRANSACTION_TYPE_LABELS[value]
  })
);

export const WEEKLY_BUDGET_IMPACT_SCOPES = [
  "normal",
  "exclude_weekly_expense",
  "exclude_weekly_and_monthly",
  "include_weekly_and_monthly_income"
] as const satisfies ReadonlyArray<WeeklyBudgetImpactScope>;

export const WEEKLY_BUDGET_IMPACT_SCOPE_LABELS: Record<
  WeeklyBudgetImpactScope,
  string
> = {
  normal: "Cuenta en semana y mes",
  exclude_weekly_expense: "No cuenta como gasto semanal, pero reduce disponible",
  exclude_weekly_and_monthly: "Excluir de semana y mes",
  include_weekly_and_monthly_income: "Cuenta en semana y mes"
};

export const WEEKLY_BUDGET_IMPACT_SCOPE_BADGE_LABELS: Record<
  WeeklyBudgetImpactScope,
  string | null
> = {
  normal: null,
  exclude_weekly_expense: "Reduce disponible semanal",
  exclude_weekly_and_monthly: "Fuera del objetivo semanal",
  include_weekly_and_monthly_income: "Ingreso extra semanal"
};

export const WEEKLY_BUDGET_IMPACT_SCOPE_OPTIONS =
  WEEKLY_BUDGET_IMPACT_SCOPES.map((value) => ({
    value,
    label: WEEKLY_BUDGET_IMPACT_SCOPE_LABELS[value]
  }));

export function getWeeklyBudgetImpactOptions(
  type: TransactionType
): Array<{
  value: WeeklyBudgetImpactScope;
  label: string;
}> {
  if (type === "income") {
    return [
      { value: "normal", label: "No contar en objetivo semanal" },
      {
        value: "include_weekly_and_monthly_income",
        label: "Cuenta en semana y mes"
      }
    ];
  }

  if (type === "transfer") {
    return [
      { value: "normal", label: "Cuenta según reglas del objetivo" },
      { value: "exclude_weekly_and_monthly", label: "Excluir de semana y mes" }
    ];
  }

  if (type === "expense") {
    return [
      { value: "normal", label: "Cuenta en semana y mes" },
      {
        value: "exclude_weekly_expense",
        label: "No cuenta como gasto semanal, pero reduce disponible"
      },
      { value: "exclude_weekly_and_monthly", label: "Excluir de semana y mes" }
    ];
  }

  return [{ value: "normal", label: "No modificar objetivo semanal" }];
}

export const RECURRING_TRANSACTION_TYPES = [
  "expense",
  "income",
  "transfer",
  "savings_allocation"
] as const satisfies ReadonlyArray<RecurringTransactionType>;

export const RECURRING_TRANSACTION_TYPE_LABELS: Record<
  RecurringTransactionType,
  string
> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer: "Transferencia",
  savings_allocation: "Asignación a ahorro"
};

export const RECURRING_TRANSACTION_TYPE_OPTIONS =
  RECURRING_TRANSACTION_TYPES.map((value) => ({
    value,
    label: RECURRING_TRANSACTION_TYPE_LABELS[value]
  }));

export const REIMBURSEMENT_STATUS_LABELS: Record<
  ReimbursementStatus,
  string
> = {
  pending: "Pendiente",
  partially_paid: "Parcial",
  paid: "Cobrado",
  cancelled: "Cancelado",
  uncollectible: "Gasto real"
};

export const RECURRING_OCCURRENCE_STATUS_LABELS: Record<
  RecurringOccurrenceStatus,
  string
> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  skipped: "Omitido"
};
