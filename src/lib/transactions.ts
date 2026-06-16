import type { Prisma, QuickTransactionTemplateType } from "@prisma/client";
import { getQuickTransactionRules } from "@/domain/transaction-rules";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { prisma } from "./prisma";

export type CreateTransactionInput = {
  type: QuickTransactionTemplateType;
  amount: number;
  date: Date;
  accountId: string;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  description: string | null;
  personName?: string | null;
  reimbursementId?: string | null;
};

export async function createTransactionFromDraft(
  input: CreateTransactionInput
) {
  return prisma.$transaction((tx) => createTransactionInTx(tx, input));
}

async function createTransactionInTx(
  tx: Prisma.TransactionClient,
  input: CreateTransactionInput
) {
  const rules = getQuickTransactionRules({
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    destinationAccountId: input.destinationAccountId,
    savingsBucketId: input.savingsBucketId
  });

  await assertAccountExists(tx, input.accountId);
  if (input.destinationAccountId) {
    await assertAccountExists(tx, input.destinationAccountId);
  }
  if (input.categoryId) {
    await assertCategoryMatchesType(tx, input.categoryId, input.type);
  }
  if (input.savingsBucketId) {
    await assertSavingsBucketExists(tx, input.savingsBucketId);
  }

  if (input.type === "reimbursable_expense") {
    const personName = input.personName?.trim();
    if (!personName) {
      throw new Error("Indica quién debe devolver el dinero.");
    }
    const title = input.description?.trim();
    if (!title) {
      throw new Error("Indica el concepto del gasto reembolsable.");
    }

    const transaction = await createBaseTransaction(tx, input, rules);
    await tx.reimbursement.create({
      data: {
        title,
        personName,
        originalTransactionId: transaction.id,
        expectedAmount: input.amount,
        paidAmount: 0,
        status: "pending"
      }
    });
    await applyRules(tx, input, rules);
    return transaction;
  }

  if (input.type === "reimbursement_income") {
    const reimbursementId = input.reimbursementId?.trim();
    if (!reimbursementId) {
      throw new Error("Selecciona el pendiente que estás cobrando.");
    }
    const reimbursement = await tx.reimbursement.findUnique({
      where: { id: reimbursementId }
    });
    if (
      !reimbursement ||
      !["pending", "partially_paid"].includes(reimbursement.status)
    ) {
      throw new Error("El pendiente seleccionado ya no admite cobros.");
    }
    const pendingAmount =
      toMoneyNumber(reimbursement.expectedAmount) -
      toMoneyNumber(reimbursement.paidAmount);
    if (input.amount > pendingAmount) {
      throw new Error("El cobro no puede superar el importe pendiente.");
    }

    const transaction = await createBaseTransaction(
      tx,
      {
        ...input,
        categoryId: null,
        reimbursementId
      },
      rules
    );
    const newPaidAmount =
      toMoneyNumber(reimbursement.paidAmount) + input.amount;
    await tx.reimbursement.update({
      where: { id: reimbursementId },
      data: {
        paidAmount: newPaidAmount,
        status:
          newPaidAmount >= toMoneyNumber(reimbursement.expectedAmount)
            ? "paid"
            : "partially_paid"
      }
    });
    await applyRules(tx, input, rules);
    return transaction;
  }

  const transaction = await createBaseTransaction(tx, input, rules);
  await applyRules(tx, input, rules);
  return transaction;
}

async function createBaseTransaction(
  tx: Prisma.TransactionClient,
  input: CreateTransactionInput,
  rules: ReturnType<typeof getQuickTransactionRules>
) {
  return tx.transaction.create({
    data: {
      date: input.date,
      amount: input.amount,
      type: input.type,
      description: input.description,
      accountId: input.accountId,
      destinationAccountId:
        input.type === "transfer" ? input.destinationAccountId : null,
      categoryId: input.categoryId,
      savingsBucketId:
        input.type === "savings_allocation" ? input.savingsBucketId : null,
      reimbursementId:
        input.type === "reimbursement_income"
          ? input.reimbursementId
          : null,
      affectsRealBalance: rules.impact.affectsRealBalance,
      affectsPersonalExpense: rules.impact.affectsPersonalExpense,
      affectsPersonalIncome: rules.impact.affectsPersonalIncome,
      affectsMonthlySavings: rules.impact.affectsMonthlySavings,
      affectsNetWorth: rules.impact.affectsNetWorth
    }
  });
}

async function applyRules(
  tx: Prisma.TransactionClient,
  input: CreateTransactionInput,
  rules: ReturnType<typeof getQuickTransactionRules>
): Promise<void> {
  for (const balanceDelta of rules.balanceDeltas) {
    await tx.account.update({
      where: { id: balanceDelta.accountId },
      data: { currentBalance: { increment: balanceDelta.delta } }
    });
  }

  if (rules.savingsBucketDelta > 0 && input.savingsBucketId) {
    await tx.savingsBucket.update({
      where: { id: input.savingsBucketId },
      data: { currentAmount: { increment: rules.savingsBucketDelta } }
    });
  }
}

async function assertAccountExists(
  tx: Prisma.TransactionClient,
  accountId: string
): Promise<void> {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: { id: true }
  });
  if (!account) throw new Error("La cuenta seleccionada no existe.");
}

async function assertSavingsBucketExists(
  tx: Prisma.TransactionClient,
  savingsBucketId: string
): Promise<void> {
  const bucket = await tx.savingsBucket.findUnique({
    where: { id: savingsBucketId },
    select: { id: true, isLongTerm: true }
  });
  if (!bucket) throw new Error("La partida de ahorro no existe.");
  if (bucket.isLongTerm) {
    throw new Error(
      "La partida Largo plazo se calcula desde cuentas y no admite asignaciones manuales."
    );
  }
}

async function assertCategoryMatchesType(
  tx: Prisma.TransactionClient,
  categoryId: string,
  type: QuickTransactionTemplateType
): Promise<void> {
  const category = await tx.category.findUnique({
    where: { id: categoryId },
    select: { type: true }
  });
  const expectedType = type === "reimbursable_expense" ? "expense" : type;
  if (
    !category ||
    (category.type !== "both" && category.type !== expectedType)
  ) {
    throw new Error("La categoría no corresponde al tipo de movimiento.");
  }
}
