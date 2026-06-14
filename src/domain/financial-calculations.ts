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

export type TransactionForCalculations = {
  date: Date | string;
  amount: MoneyValue;
  type: TransactionType;
  affectsPersonalExpense: boolean;
  affectsPersonalIncome: boolean;
  affectsMonthlySavings: boolean;
  affectsNetWorth: boolean;
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
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  if ("toNumber" in value) {
    return value.toNumber();
  }

  return Number(value.toString());
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

  return (
    accountNetWorth + calculatePendingReimbursements(reimbursements).totalPending
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
