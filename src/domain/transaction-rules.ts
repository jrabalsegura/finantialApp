import {
  getDefaultTransactionImpact,
  type TransactionImpact
} from "./financial-calculations";

export type QuickTransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "reimbursable_expense"
  | "reimbursement_income"
  | "savings_allocation";
export type ReimbursementTransactionType =
  | "reimbursable_expense"
  | "reimbursement_income";

export type AccountBalanceDelta = {
  accountId: string;
  delta: number;
};

export type QuickTransactionInput = {
  type: QuickTransactionType;
  amount: number;
  accountId: string;
  destinationAccountId?: string | null;
  savingsBucketId?: string | null;
};

export type QuickTransactionRules = {
  impact: TransactionImpact;
  balanceDeltas: AccountBalanceDelta[];
  savingsBucketDelta: number;
};

export type ReimbursementTransactionInput = {
  type: ReimbursementTransactionType;
  amount: number;
  accountId: string;
};

export type ConvertReimbursementInput = {
  pendingAmount: number;
  accountId: string;
};

export function getQuickTransactionRules(
  input: QuickTransactionInput
): QuickTransactionRules {
  validateQuickTransactionInput(input);

  if (input.type === "expense") {
    return {
      impact: getDefaultTransactionImpact("expense"),
      balanceDeltas: [{ accountId: input.accountId, delta: -input.amount }],
      savingsBucketDelta: 0
    };
  }

  if (input.type === "income") {
    return {
      impact: getDefaultTransactionImpact("income"),
      balanceDeltas: [{ accountId: input.accountId, delta: input.amount }],
      savingsBucketDelta: 0
    };
  }

  if (input.type === "transfer") {
    return {
      impact: getDefaultTransactionImpact("transfer"),
      balanceDeltas: [
        { accountId: input.accountId, delta: -input.amount },
        { accountId: input.destinationAccountId as string, delta: input.amount }
      ],
      savingsBucketDelta: 0
    };
  }

  if (input.type === "reimbursable_expense") {
    return {
      impact: getDefaultTransactionImpact("reimbursable_expense"),
      balanceDeltas: [{ accountId: input.accountId, delta: -input.amount }],
      savingsBucketDelta: 0
    };
  }

  if (input.type === "reimbursement_income") {
    return {
      impact: getDefaultTransactionImpact("reimbursement_income"),
      balanceDeltas: [{ accountId: input.accountId, delta: input.amount }],
      savingsBucketDelta: 0
    };
  }

  return {
    impact: getDefaultTransactionImpact("savings_allocation"),
    balanceDeltas: [],
    savingsBucketDelta: input.amount
  };
}

export function getReimbursementTransactionRules(
  input: ReimbursementTransactionInput
): QuickTransactionRules {
  return getQuickTransactionRules(input);
}

export function getConvertReimbursementToExpenseRules(
  input: ConvertReimbursementInput
): QuickTransactionRules {
  validateAmountAndAccount(input.pendingAmount, input.accountId);

  return {
    impact: {
      ...getDefaultTransactionImpact("expense"),
      affectsRealBalance: false,
      affectsNetWorth: false
    },
    balanceDeltas: [],
    savingsBucketDelta: 0
  };
}

function validateQuickTransactionInput(input: QuickTransactionInput): void {
  validateAmountAndAccount(input.amount, input.accountId);

  if (input.type === "transfer") {
    if (!input.destinationAccountId) {
      throw new Error("Selecciona la cuenta de destino.");
    }

    if (input.destinationAccountId === input.accountId) {
      throw new Error("La cuenta de destino debe ser distinta.");
    }
  }

  if (input.type === "savings_allocation" && !input.savingsBucketId) {
    throw new Error("Selecciona una partida de ahorro.");
  }
}

function validateAmountAndAccount(amount: number, accountId: string): void {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }

  if (!accountId) {
    throw new Error("Selecciona una cuenta.");
  }
}
