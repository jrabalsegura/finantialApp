import type { Prisma } from "@prisma/client";

/** A backdated change would also invalidate every later financial snapshot. */
export async function assertPeriodOpen(
  tx: Prisma.TransactionClient,
  date: Date
): Promise<void> {
  if (!Number.isFinite(date.getTime())) throw new Error("Fecha no válida.");
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const close = await tx.monthlyClose.findFirst({
    where: { OR: [{ year: { gt: year } }, { year, month: { gte: month } }] },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { year: true, month: true }
  });
  if (close)
    throw new Error(
      `Reabre primero el cierre ${String(close.month).padStart(2, "0")}/${close.year} para modificar este período.`
    );
}

export async function isPeriodClosed(
  tx: Prisma.TransactionClient,
  year: number,
  month: number
): Promise<boolean> {
  return !!(await tx.monthlyClose.findFirst({
    where: { OR: [{ year: { gt: year } }, { year, month: { gte: month } }] },
    select: { id: true }
  }));
}
