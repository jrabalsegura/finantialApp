import type { Prisma } from "@prisma/client";

/** Persist rounded decimals after each operation; SQLite increments otherwise accumulate binary error. */
export async function adjustAccountBalance(
  tx: Prisma.TransactionClient,
  id: string,
  delta: number
) {
  const account = await tx.account.findUniqueOrThrow({ where: { id } });
  return tx.account.update({
    where: { id },
    data: {
      currentBalance: account.currentBalance.plus(delta).toDecimalPlaces(2)
    }
  });
}

export async function adjustBucketBalance(
  tx: Prisma.TransactionClient,
  id: string,
  delta: number
) {
  const bucket = await tx.savingsBucket.findUniqueOrThrow({ where: { id } });
  const currentAmount = bucket.currentAmount.plus(delta).toDecimalPlaces(2);
  if (currentAmount.isNegative())
    throw new Error(`No hay saldo suficiente en la partida ${bucket.name}.`);
  return tx.savingsBucket.update({ where: { id }, data: { currentAmount } });
}
