import type {
  AccountType,
  QuickTransactionTemplateType,
  RecurringOccurrenceStatus,
  RecurringTransactionType,
  ReimbursementStatus,
  TransactionType
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
