import type {
  Prisma,
  QuickTransactionTemplateType
} from "@prisma/client";
import { prisma } from "./prisma";

export type QuickTemplateInput = {
  name: string;
  type: QuickTransactionTemplateType;
  defaultAmount: number | null;
  accountId: string | null;
  destinationAccountId: string | null;
  categoryId: string | null;
  savingsBucketId: string | null;
  defaultDescription: string | null;
  icon: string | null;
  color: string | null;
  sortOrder: number;
  isFavorite: boolean;
  isActive: boolean;
};

const quickTemplateInclude = {
  account: { select: { id: true, name: true } },
  destinationAccount: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  savingsBucket: { select: { id: true, name: true } }
} satisfies Prisma.QuickTransactionTemplateInclude;

export function getQuickTemplates(options?: {
  activeOnly?: boolean;
  favoritesOnly?: boolean;
}) {
  return prisma.quickTransactionTemplate.findMany({
    where: {
      ...(options?.activeOnly ? { isActive: true } : {}),
      ...(options?.favoritesOnly ? { isFavorite: true } : {})
    },
    orderBy: [
      { isActive: "desc" },
      { isFavorite: "desc" },
      { sortOrder: "asc" },
      { name: "asc" }
    ],
    include: quickTemplateInclude
  });
}

export async function createQuickTemplate(input: QuickTemplateInput) {
  return prisma.$transaction(async (tx) => {
    await validateQuickTemplateRelations(tx, input);
    return tx.quickTransactionTemplate.create({
      data: input,
      include: quickTemplateInclude
    });
  });
}

export async function updateQuickTemplate(
  id: string,
  input: QuickTemplateInput
) {
  return prisma.$transaction(async (tx) => {
    await validateQuickTemplateRelations(tx, input);
    return tx.quickTransactionTemplate.update({
      where: { id },
      data: input,
      include: quickTemplateInclude
    });
  });
}

async function validateQuickTemplateRelations(
  tx: Prisma.TransactionClient,
  input: QuickTemplateInput
): Promise<void> {
  if (input.defaultAmount !== null && input.defaultAmount <= 0) {
    throw new Error("El importe por defecto debe ser mayor que cero.");
  }

  if (input.accountId) {
    const account = await tx.account.findUnique({
      where: { id: input.accountId },
      select: { id: true }
    });
    if (!account) throw new Error("La cuenta seleccionada no existe.");
  }

  if (input.type === "transfer") {
    if (!input.destinationAccountId) {
      throw new Error("Selecciona la cuenta de destino.");
    }
    if (input.destinationAccountId === input.accountId) {
      throw new Error("La cuenta de destino debe ser distinta.");
    }
    const destination = await tx.account.findUnique({
      where: { id: input.destinationAccountId },
      select: { id: true }
    });
    if (!destination) throw new Error("La cuenta de destino no existe.");
  }

  if (input.categoryId) {
    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
      select: { type: true }
    });
    const expectedType =
      input.type === "reimbursable_expense" ? "expense" : input.type;
    if (
      !category ||
      (category.type !== "both" && category.type !== expectedType)
    ) {
      throw new Error("La categoría no corresponde al tipo de movimiento.");
    }
  }

  if (input.type === "savings_allocation") {
    if (!input.savingsBucketId) {
      throw new Error("Selecciona una partida de ahorro.");
    }
    const bucket = await tx.savingsBucket.findUnique({
      where: { id: input.savingsBucketId },
      select: { id: true }
    });
    if (!bucket) throw new Error("La partida de ahorro no existe.");
  }
}
