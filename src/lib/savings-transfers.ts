import { adjustBucketBalance } from "@/lib/balances";
import type { Prisma } from "@prisma/client";
import { assertPeriodOpen } from "./closed-periods";
import { toMoneyNumber } from "@/domain/financial-calculations";

export async function undoSavingsTransferInTransaction(
  tx: Prisma.TransactionClient,
  savingsTransferId: string
) {
  const legs = await tx.transaction.findMany({ where: { savingsTransferId } });
  const withdrawal = legs.find((leg) => leg.type === "savings_withdrawal");
  const allocation = legs.find((leg) => leg.type === "savings_allocation");
  if (
    legs.length !== 2 ||
    !withdrawal?.savingsBucketId ||
    !allocation?.savingsBucketId ||
    withdrawal.savingsBucketId === allocation.savingsBucketId ||
    !withdrawal.amount.equals(allocation.amount)
  )
    throw new Error(
      "La transferencia está incompleta. Revisa sus movimientos antes de deshacerla."
    );
  for (const leg of legs) {
    await assertPeriodOpen(tx, leg.date);
    if (leg.monthlyCloseId || leg.affectsRealBalance)
      throw new Error(
        "Esta operación no es una transferencia manual entre partidas."
      );
  }
  const destination = await tx.savingsBucket.findUniqueOrThrow({
    where: { id: allocation.savingsBucketId }
  });
  const amount = toMoneyNumber(allocation.amount);
  if (toMoneyNumber(destination.currentAmount) < amount)
    throw new Error(
      "Devuelve primero el dinero utilizado de la partida de destino para deshacer la transferencia."
    );
  await adjustBucketBalance(tx, allocation.savingsBucketId, -amount);
  await adjustBucketBalance(tx, withdrawal.savingsBucketId, amount);
  await tx.transaction.deleteMany({ where: { savingsTransferId } });
}
