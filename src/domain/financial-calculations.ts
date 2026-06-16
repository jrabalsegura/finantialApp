import { normalizeMoney } from "./money";

export type MoneyValue =
  | number
  | string
  | {
      toNumber: () => number;
    }
  | {
      toString: () => string;
    };

export type TransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "balance_adjustment"
  | "reimbursable_expense"
  | "reimbursement_income"
  | "investment_gain"
  | "investment_loss"
  | "savings_allocation"
  | "savings_withdrawal";

export type ReimbursementStatus =
  | "pending"
  | "partially_paid"
  | "paid"
  | "cancelled"
  | "uncollectible";

export type AccountForCalculations = {
  currentBalance: MoneyValue;
  includeInAvailableMoney: boolean;
  includeInNetWorth: boolean;
};

export type LongTermAccountType = "investment" | "pension" | "treasury";

export type AccountForLongTermBucketAdjustment = {
  currentBalance?: MoneyValue;
  difference: MoneyValue;
  includeInMonthlySavings: boolean;
  includeInNetWorth: boolean;
  type: string;
};

export type TransactionForCalculations = {
  date: Date | string;
  amount: MoneyValue;
  type: TransactionType;
  affectsPersonalExpense: boolean;
  affectsPersonalIncome: boolean;
  affectsMonthlySavings: boolean;
  affectsNetWorth: boolean;
};

export type LongTermTransferForCalculations = {
  account: Pick<
    AccountForLongTermBucketAdjustment,
    "includeInMonthlySavings" | "includeInNetWorth" | "type"
  >;
  amount: MoneyValue;
  destinationAccount: Pick<
    AccountForLongTermBucketAdjustment,
    "includeInMonthlySavings" | "includeInNetWorth" | "type"
  > | null;
  type: TransactionType;
};

export type ReimbursementForCalculations = {
  id: string;
  title: string;
  personName: string;
  expectedAmount: MoneyValue;
  paidAmount: MoneyValue;
  status: ReimbursementStatus;
  dueDate?: Date | string | null;
};

export type SavingsBucketForCalculations = {
  currentAmount: MoneyValue;
};

export type BucketAdjustmentInput = {
  amount: MoneyValue;
  bucketId: string;
};

export type BucketBalanceInput = {
  currentAmount: MoneyValue;
  id: string;
};

export type BucketAdjustmentType = "allocation" | "reduction";

export type MonthlyCloseResult = {
  deficit: number;
  kind: "positive" | "zero" | "negative";
  monthlySavings: number;
  surplus: number;
};

export type BucketAdjustmentValidation = {
  pendingAmount: number;
  totalAmount: number;
};

export type ProjectedBucketBalance = {
  adjustmentAmount: number;
  bucketId: string;
  currentAmount: number;
  finalAmount: number;
};

export type MonthlyBucketSnapshotInput = {
  amount: MoneyValue;
  id: string;
};

export type MonthlyBucketSnapshotDraft = {
  amount: number;
  savingsBucketId: string;
};

export type TransactionImpact = {
  affectsRealBalance: boolean;
  affectsPersonalExpense: boolean;
  affectsPersonalIncome: boolean;
  affectsMonthlySavings: boolean;
  affectsNetWorth: boolean;
};

export type PendingReimbursement = {
  id: string;
  title: string;
  personName: string;
  expectedAmount: number;
  paidAmount: number;
  pendingAmount: number;
  status: Extract<ReimbursementStatus, "pending" | "partially_paid">;
  dueDate?: Date | null;
};

export type PendingReimbursementsSummary = {
  totalPending: number;
  count: number;
  items: PendingReimbursement[];
};

const DEFAULT_TRANSACTION_IMPACT: Record<TransactionType, TransactionImpact> = {
  expense: {
    affectsRealBalance: true,
    affectsPersonalExpense: true,
    affectsPersonalIncome: false,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  },
  income: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: true,
    affectsMonthlySavings: true,
    affectsNetWorth: true
  },
  transfer: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false
  },
  balance_adjustment: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: true
  },
  reimbursable_expense: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false
  },
  reimbursement_income: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false
  },
  investment_gain: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: true
  },
  investment_loss: {
    affectsRealBalance: true,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: true
  },
  savings_allocation: {
    affectsRealBalance: false,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false
  },
  savings_withdrawal: {
    affectsRealBalance: false,
    affectsPersonalExpense: false,
    affectsPersonalIncome: false,
    affectsMonthlySavings: false,
    affectsNetWorth: false
  }
};

const PENDING_REIMBURSEMENT_STATUSES = new Set<ReimbursementStatus>([
  "pending",
  "partially_paid"
]);

export function toMoneyNumber(value: MoneyValue): number {
  if (typeof value === "number") {
    return normalizeMoney(value);
  }

  if (typeof value === "string") {
    return normalizeMoney(Number(value));
  }

  if ("toNumber" in value) {
    return normalizeMoney(value.toNumber());
  }

  return normalizeMoney(Number(value.toString()));
}

export function getDefaultTransactionImpact(
  type: TransactionType
): TransactionImpact {
  return { ...DEFAULT_TRANSACTION_IMPACT[type] };
}

export function transactionAffectsMonthlySavings(
  transaction: Pick<TransactionForCalculations, "affectsMonthlySavings">
): boolean {
  return transaction.affectsMonthlySavings;
}

export function transactionAffectsNetWorth(
  transaction: Pick<TransactionForCalculations, "affectsNetWorth">
): boolean {
  return transaction.affectsNetWorth;
}

export function calculateAvailableMoney(
  accounts: AccountForCalculations[]
): number {
  return sumMoney(
    accounts
      .filter((account) => account.includeInAvailableMoney)
      .map((account) => account.currentBalance)
  );
}

export function calculateAssignedSavings(
  savingsBuckets: SavingsBucketForCalculations[]
): number {
  return sumMoney(
    savingsBuckets.map((savingsBucket) => savingsBucket.currentAmount)
  );
}

export function calculateUnassignedAvailableMoney(
  accounts: AccountForCalculations[],
  savingsBuckets: SavingsBucketForCalculations[]
): number {
  return calculateAvailableMoney(accounts) - calculateAssignedSavings(savingsBuckets);
}

export function accountFeedsLongTermBucket(
  account: Pick<
    AccountForLongTermBucketAdjustment,
    "includeInMonthlySavings" | "includeInNetWorth" | "type"
  >
): boolean {
  return (
    !account.includeInMonthlySavings &&
    account.includeInNetWorth &&
    isLongTermAccountType(account.type)
  );
}

export function calculateLongTermBucketAdjustment(
  accounts: AccountForLongTermBucketAdjustment[]
): number {
  return sumMoney(
    accounts
      .filter(accountFeedsLongTermBucket)
      .map((account) => account.difference)
  );
}

export function calculateLongTermBucketBalance(
  accounts: Array<
    Pick<
      AccountForLongTermBucketAdjustment,
      "currentBalance" | "includeInMonthlySavings" | "includeInNetWorth" | "type"
    >
  >
): number {
  return sumMoney(
    accounts
      .filter(
        (
          account
        ): account is Required<
          Pick<
            AccountForLongTermBucketAdjustment,
            | "currentBalance"
            | "includeInMonthlySavings"
            | "includeInNetWorth"
            | "type"
          >
        > =>
          account.currentBalance != null && accountFeedsLongTermBucket(account)
      )
      .map((account) => account.currentBalance)
  );
}

export function calculateLongTermTransferAllocation(
  transactions: LongTermTransferForCalculations[]
): number {
  return sumMoney(
    transactions.map((transaction) => {
      if (transaction.type !== "transfer" || !transaction.destinationAccount) {
        return 0;
      }

      const sourceFeedsLongTerm = accountFeedsLongTermBucket(
        transaction.account
      );
      const destinationFeedsLongTerm = accountFeedsLongTermBucket(
        transaction.destinationAccount
      );

      if (!sourceFeedsLongTerm && destinationFeedsLongTerm) {
        return transaction.amount;
      }

      if (sourceFeedsLongTerm && !destinationFeedsLongTerm) {
        return -toMoneyNumber(transaction.amount);
      }

      return 0;
    })
  );
}

export function getManualMonthlyCloseResult(
  monthlySavings: MoneyValue,
  automaticLongTermSavings: MoneyValue
): MonthlyCloseResult {
  const result = getMonthlyCloseResult(monthlySavings);

  if (result.kind !== "positive") {
    return result;
  }

  const manualSurplus = Math.max(
    result.surplus - Math.max(toMoneyNumber(automaticLongTermSavings), 0),
    0
  );

  return getMonthlyCloseResult(manualSurplus);
}

export function getMonthlyCloseResult(monthlySavings: MoneyValue): MonthlyCloseResult {
  const normalizedMonthlySavings = toMoneyNumber(monthlySavings);

  if (normalizedMonthlySavings > 0) {
    return {
      deficit: 0,
      kind: "positive",
      monthlySavings: normalizedMonthlySavings,
      surplus: normalizedMonthlySavings
    };
  }

  if (normalizedMonthlySavings < 0) {
    return {
      deficit: Math.abs(normalizedMonthlySavings),
      kind: "negative",
      monthlySavings: normalizedMonthlySavings,
      surplus: 0
    };
  }

  return {
    deficit: 0,
    kind: "zero",
    monthlySavings: 0,
    surplus: 0
  };
}

export function validatePositiveBucketAllocations(
  allocations: BucketAdjustmentInput[],
  monthlySavings: MoneyValue
): BucketAdjustmentValidation {
  const result = getMonthlyCloseResult(monthlySavings);
  const totalAllocated = sumBucketAdjustments(allocations);

  if (allocations.some((allocation) => toMoneyNumber(allocation.amount) < 0)) {
    throw new Error("El reparto de ahorro no puede contener importes negativos.");
  }

  if (totalAllocated < 0) {
    throw new Error("El reparto de ahorro no puede ser negativo.");
  }

  if (result.kind !== "positive" && totalAllocated > 0) {
    throw new Error("No se puede repartir ahorro si el ahorro mensual no es positivo.");
  }

  if (result.kind === "positive" && totalAllocated > result.surplus) {
    throw new Error("El reparto no puede superar el ahorro mensual real.");
  }

  if (result.kind === "positive" && totalAllocated < result.surplus) {
    throw new Error("Todo el ahorro mensual debe quedar asignado a partidas.");
  }

  return {
    pendingAmount: roundMoney(result.surplus - totalAllocated),
    totalAmount: totalAllocated
  };
}

export function validateNegativeBucketReductions(
  reductions: BucketAdjustmentInput[],
  monthlySavings: MoneyValue,
  buckets: BucketBalanceInput[]
): BucketAdjustmentValidation {
  const result = getMonthlyCloseResult(monthlySavings);
  const totalReduced = sumBucketAdjustments(reductions);

  if (reductions.some((reduction) => toMoneyNumber(reduction.amount) < 0)) {
    throw new Error("La reducción de partidas no puede contener importes negativos.");
  }

  if (result.kind !== "negative") {
    if (totalReduced > 0) {
      throw new Error("Solo se pueden reducir partidas si el ahorro mensual es negativo.");
    }

    return {
      pendingAmount: 0,
      totalAmount: totalReduced
    };
  }

  const bucketBalanceById = new Map(
    buckets.map((bucket) => [bucket.id, toMoneyNumber(bucket.currentAmount)])
  );
  const totalAvailableInBuckets = sumMoney(
    buckets.map((bucket) => bucket.currentAmount)
  );

  if (totalAvailableInBuckets < result.deficit) {
    throw new Error(
      "No hay saldo suficiente en partidas para cubrir todo el déficit."
    );
  }

  for (const reduction of reductions) {
    const reductionAmount = toMoneyNumber(reduction.amount);
    const currentAmount = bucketBalanceById.get(reduction.bucketId);

    if (currentAmount == null) {
      throw new Error("La partida de ahorro seleccionada no existe.");
    }

    if (reductionAmount > currentAmount) {
      throw new Error(
        "No se puede reducir una partida por encima de su saldo actual."
      );
    }
  }

  if (totalReduced < result.deficit) {
    throw new Error("El déficit mensual debe quedar totalmente cubierto.");
  }

  if (totalReduced > result.deficit) {
    throw new Error("La reducción no puede superar el déficit mensual.");
  }

  return {
    pendingAmount: roundMoney(result.deficit - totalReduced),
    totalAmount: totalReduced
  };
}

export function calculateProjectedBucketBalance(
  bucket: BucketBalanceInput,
  adjustmentAmount: MoneyValue,
  type: BucketAdjustmentType
): ProjectedBucketBalance {
  const currentAmount = toMoneyNumber(bucket.currentAmount);
  const normalizedAdjustmentAmount = toMoneyNumber(adjustmentAmount);
  const signedAdjustment =
    type === "allocation"
      ? normalizedAdjustmentAmount
      : -normalizedAdjustmentAmount;

  return {
    adjustmentAmount: normalizedAdjustmentAmount,
    bucketId: bucket.id,
    currentAmount,
    finalAmount: roundMoney(currentAmount + signedAdjustment)
  };
}

export function applyBucketAllocations(
  buckets: BucketBalanceInput[],
  allocations: BucketAdjustmentInput[]
): ProjectedBucketBalance[] {
  return applyBucketAdjustments(buckets, allocations, "allocation");
}

export function applyBucketReductions(
  buckets: BucketBalanceInput[],
  reductions: BucketAdjustmentInput[]
): ProjectedBucketBalance[] {
  return applyBucketAdjustments(buckets, reductions, "reduction");
}

export function createMonthlyBucketSnapshots(
  buckets: MonthlyBucketSnapshotInput[]
): MonthlyBucketSnapshotDraft[] {
  return buckets.map((bucket) => ({
    amount: toMoneyNumber(bucket.amount),
    savingsBucketId: bucket.id
  }));
}

export function calculatePendingReimbursements(
  reimbursements: ReimbursementForCalculations[]
): PendingReimbursementsSummary {
  const items = reimbursements
    .filter((reimbursement) =>
      PENDING_REIMBURSEMENT_STATUSES.has(reimbursement.status)
    )
    .map((reimbursement) => {
      const expectedAmount = toMoneyNumber(reimbursement.expectedAmount);
      const paidAmount = toMoneyNumber(reimbursement.paidAmount);
      const pendingAmount = Math.max(expectedAmount - paidAmount, 0);

      return {
        id: reimbursement.id,
        title: reimbursement.title,
        personName: reimbursement.personName,
        expectedAmount,
        paidAmount,
        pendingAmount,
        status: reimbursement.status as PendingReimbursement["status"],
        dueDate: reimbursement.dueDate
          ? new Date(reimbursement.dueDate)
          : null
      };
    })
    .filter((reimbursement) => reimbursement.pendingAmount > 0);

  return {
    totalPending: sumMoney(items.map((item) => item.pendingAmount)),
    count: items.length,
    items
  };
}

export function calculateNetWorth(
  accounts: AccountForCalculations[],
  reimbursements: ReimbursementForCalculations[] = []
): number {
  const accountNetWorth = sumMoney(
    accounts
      .filter((account) => account.includeInNetWorth)
      .map((account) => account.currentBalance)
  );

  // Un reembolso pendiente sigue siendo un derecho de cobro: no es dinero
  // disponible, pero sí forma parte del patrimonio mientras sea cobrable.
  return (
    accountNetWorth + calculatePendingReimbursements(reimbursements).totalPending
  );
}

export function calculateNetWorthVariation(
  currentNetWorth: MoneyValue,
  previousNetWorth: MoneyValue | null | undefined
): number | null {
  if (previousNetWorth == null) {
    return null;
  }

  return roundMoney(
    toMoneyNumber(currentNetWorth) - toMoneyNumber(previousNetWorth)
  );
}

export function calculateRealMonthlyIncome(
  transactions: TransactionForCalculations[],
  year: number,
  month: number
): number {
  return sumMonthlyTransactions(
    transactions,
    year,
    month,
    (transaction) => transaction.affectsPersonalIncome
  );
}

export function calculateRealMonthlyExpense(
  transactions: TransactionForCalculations[],
  year: number,
  month: number
): number {
  return sumMonthlyTransactions(
    transactions,
    year,
    month,
    (transaction) => transaction.affectsPersonalExpense
  );
}

export function calculateRealMonthlySavings(
  transactions: TransactionForCalculations[],
  year: number,
  month: number
): number {
  const monthlyTransactions = transactions.filter((transaction) =>
    isTransactionInMonth(transaction, year, month)
  );

  // El ahorro mensual mide ingresos personales menos gastos personales.
  // Transferencias, reembolsos y revalorizaciones quedan fuera aunque cambien saldos.
  const income = sumMoney(
    monthlyTransactions
      .filter(
        (transaction) =>
          transaction.affectsPersonalIncome &&
          transactionAffectsMonthlySavings(transaction)
      )
      .map((transaction) => transaction.amount)
  );

  const expense = sumMoney(
    monthlyTransactions
      .filter(
        (transaction) =>
          transaction.affectsPersonalExpense &&
          transactionAffectsMonthlySavings(transaction)
      )
      .map((transaction) => transaction.amount)
  );

  return income - expense;
}

export function isTransactionInMonth(
  transaction: Pick<TransactionForCalculations, "date">,
  year: number,
  month: number
): boolean {
  const date = new Date(transaction.date);
  const { start, end } = getMonthDateRange(year, month);

  return date >= start && date < end;
}

export function getMonthDateRange(
  year: number,
  month: number
): { start: Date; end: Date } {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("month must be an integer between 1 and 12");
  }

  return {
    start: new Date(year, month - 1, 1),
    end: new Date(year, month, 1)
  };
}

function sumMonthlyTransactions(
  transactions: TransactionForCalculations[],
  year: number,
  month: number,
  predicate: (transaction: TransactionForCalculations) => boolean
): number {
  return sumMoney(
    transactions
      .filter(
        (transaction) =>
          isTransactionInMonth(transaction, year, month) &&
          predicate(transaction)
      )
      .map((transaction) => transaction.amount)
  );
}

function sumMoney(values: MoneyValue[]): number {
  return values.reduce<number>(
    (total, value) => total + toMoneyNumber(value),
    0
  );
}

function sumBucketAdjustments(adjustments: BucketAdjustmentInput[]): number {
  return sumMoney(adjustments.map((adjustment) => adjustment.amount));
}

function applyBucketAdjustments(
  buckets: BucketBalanceInput[],
  adjustments: BucketAdjustmentInput[],
  type: BucketAdjustmentType
): ProjectedBucketBalance[] {
  const adjustmentByBucketId = new Map(
    adjustments.map((adjustment) => [
      adjustment.bucketId,
      toMoneyNumber(adjustment.amount)
    ])
  );

  return buckets.map((bucket) =>
    calculateProjectedBucketBalance(
      bucket,
      adjustmentByBucketId.get(bucket.id) ?? 0,
      type
    )
  );
}

function isLongTermAccountType(type: string): type is LongTermAccountType {
  return type === "investment" || type === "pension" || type === "treasury";
}

function roundMoney(value: number): number {
  return normalizeMoney(value);
}
