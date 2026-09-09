import type { Prisma } from "@prisma/client";
import { toMoneyNumber } from "@/domain/financial-calculations";
import { normalizeMoney } from "@/domain/money";

export async function getChangesAfter(
  tx: Prisma.TransactionClient,
  cutoff: Date
) {
  const transactions = await tx.transaction.findMany({
    where: { date: { gte: cutoff } },
    include: { accountSnapshots: { select: { difference: true } } }
  });
  const accounts = new Map<string, number>();
  const buckets = new Map<string, number>();
  const add = (map: Map<string, number>, id: string, delta: number) =>
    map.set(id, normalizeMoney((map.get(id) ?? 0) + delta));
  for (const transaction of transactions) {
    const amount = toMoneyNumber(transaction.amount);
    if (transaction.affectsRealBalance) {
      let delta: number;
      switch (transaction.type) {
        case "expense":
        case "reimbursable_expense":
        case "investment_loss":
        case "transfer":
          delta = -amount;
          break;
        case "income":
        case "reimbursement_income":
        case "investment_gain":
          delta = amount;
          break;
        case "balance_adjustment": {
          const value =
            transaction.balanceDelta ??
            transaction.accountSnapshots[0]?.difference;
          if (value == null)
            throw new Error(
              "Hay un ajuste posterior sin dirección registrada. Revisa ese ajuste antes de cerrar un mes anterior."
            );
          delta = toMoneyNumber(value);
          break;
        }
        default:
          delta = 0;
      }
      add(accounts, transaction.accountId, delta);
      if (transaction.type === "transfer" && transaction.destinationAccountId)
        add(accounts, transaction.destinationAccountId, amount);
    }
    if (
      transaction.savingsBucketId &&
      ["savings_allocation", "savings_withdrawal"].includes(transaction.type)
    ) {
      add(
        buckets,
        transaction.savingsBucketId,
        transaction.type === "savings_allocation" ? amount : -amount
      );
    }
  }
  return { accounts, buckets };
}

export async function getReimbursementsAt(
  tx: Prisma.TransactionClient,
  cutoff: Date
) {
  const reimbursements = await tx.reimbursement.findMany({
    where: { originalTransaction: { date: { lt: cutoff } } },
    include: { payments: { where: { date: { lt: cutoff } } } }
  });
  return reimbursements.map((item) => {
    const paidAmount = normalizeMoney(
      item.payments
        .filter((p) => p.type === "reimbursement_income")
        .reduce((sum, p) => sum + toMoneyNumber(p.amount), 0)
    );
    const converted = item.payments.some((p) => p.type === "expense");
    const legacyTerminal =
      ["cancelled", "uncollectible"].includes(item.status) &&
      item.updatedAt < cutoff;
    const status =
      converted || legacyTerminal
        ? ("uncollectible" as const)
        : paidAmount >= toMoneyNumber(item.expectedAmount)
          ? ("paid" as const)
          : paidAmount > 0
            ? ("partially_paid" as const)
            : ("pending" as const);
    return { ...item, paidAmount, status };
  });
}
