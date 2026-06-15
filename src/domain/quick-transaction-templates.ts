import type { QuickTransactionTemplateType } from "@prisma/client";
import { toMoneyNumber, type MoneyValue } from "./financial-calculations";

export type QuickTemplateForDraft = {
  id: string;
  name: string;
  type: QuickTransactionTemplateType;
  defaultAmount: MoneyValue | null;
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  defaultDescription: string | null;
};

export type QuickTransactionDraft = {
  templateId: string | null;
  type: QuickTransactionTemplateType;
  amount: number | null;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  description: string;
};

export function buildTransactionDraftFromTemplate(
  template: QuickTemplateForDraft,
  defaultAccountId: string
): QuickTransactionDraft {
  if (!defaultAccountId && !template.accountId) {
    throw new Error("No hay una cuenta disponible para crear el borrador.");
  }

  return {
    templateId: template.id,
    type: template.type,
    amount:
      template.defaultAmount === null
        ? null
        : toMoneyNumber(template.defaultAmount),
    accountId: template.accountId ?? defaultAccountId,
    destinationAccountId:
      template.type === "transfer" ? template.destinationAccountId : null,
    categoryId: supportsCategory(template.type) ? template.categoryId : null,
    savingsBucketId:
      template.type === "savings_allocation"
        ? template.savingsBucketId
        : null,
    description: template.defaultDescription ?? template.name
  };
}

export function supportsCategory(
  type: QuickTransactionTemplateType
): boolean {
  return (
    type === "expense" ||
    type === "income" ||
    type === "reimbursable_expense"
  );
}
