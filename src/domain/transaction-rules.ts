import {
  getDefaultTransactionImpact,
  type TransactionImpact
} from "./financial-calculations";

export type QuickTransactionType = "expense" | "income" | "transfer";

export type AccountBalanceDelta = {
  accountId: string;
  delta: number;
};

export type QuickTransactionInput = {
  type: QuickTransactionType;
  amount: number;
  accountId: string;
  destinationAccountId?: string | null;
};

export type QuickTransactionRules = {
  impact: TransactionImpact;
  balanceDeltas: AccountBalanceDelta[];
};

export function getQuickTransactionRules(
  input: QuickTransactionInput
): QuickTransactionRules {
  validateQuickTransactionInput(input);

  if (input.type === "expense") {
    return {
      impact: getDefaultTransactionImpact("expense"),
      balanceDeltas: [{ accountId: input.accountId, delta: -input.amount }]
    };
  }

  if (input.type === "income") {
    return {
      impact: getDefaultTransactionImpact("income"),
      balanceDeltas: [{ accountId: input.accountId, delta: input.amount }]
    };
  }

  return {
    impact: getDefaultTransactionImpact("transfer"),
    balanceDeltas: [
      { accountId: input.accountId, delta: -input.amount },
      { accountId: input.destinationAccountId as string, delta: input.amount }
    ]
  };
}

function validateQuickTransactionInput(input: QuickTransactionInput): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }

  if (!input.accountId) {
    throw new Error("Selecciona una cuenta.");
  }

  if (input.type === "transfer") {
    if (!input.destinationAccountId) {
      throw new Error("Selecciona la cuenta de destino.");
    }

    if (input.destinationAccountId === input.accountId) {
      throw new Error("La cuenta de destino debe ser distinta.");
    }
  }
}
