"use server";

import type { QuickTransactionTemplateType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  createQuickTemplate,
  updateQuickTemplate,
  type QuickTemplateInput
} from "@/lib/quick-transaction-templates";
import { QUICK_TRANSACTION_TYPES } from "@/domain/domain-options";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = new Set<QuickTransactionTemplateType>(
  QUICK_TRANSACTION_TYPES
);

export async function createQuickTemplateAction(
  formData: FormData
): Promise<void> {
  await createQuickTemplate(parseTemplateForm(formData));
  revalidateQuickTemplateViews();
}

export async function updateQuickTemplateAction(
  formData: FormData
): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  await updateQuickTemplate(id, parseTemplateForm(formData));
  revalidateQuickTemplateViews();
}

export async function toggleQuickTemplateActive(
  formData: FormData
): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const isActive = formData.get("isActive") === "true";
  await prisma.quickTransactionTemplate.update({
    where: { id },
    data: { isActive }
  });
  revalidateQuickTemplateViews();
}

export async function toggleQuickTemplateFavorite(
  formData: FormData
): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const isFavorite = formData.get("isFavorite") === "true";
  await prisma.quickTransactionTemplate.update({
    where: { id },
    data: { isFavorite }
  });
  revalidateQuickTemplateViews();
}

export async function moveQuickTemplate(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const direction = formData.get("direction");
  if (direction !== "up" && direction !== "down") {
    throw new Error("Dirección de orden no válida.");
  }

  await prisma.$transaction(async (tx) => {
    const templates = await tx.quickTransactionTemplate.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, sortOrder: true }
    });
    const index = templates.findIndex((template) => template.id === id);
    const otherIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || otherIndex < 0 || otherIndex >= templates.length) return;

    const current = templates[index];
    const other = templates[otherIndex];
    const currentOrder =
      current.sortOrder === other.sortOrder ? index : current.sortOrder;
    const otherOrder =
      current.sortOrder === other.sortOrder ? otherIndex : other.sortOrder;

    await tx.quickTransactionTemplate.update({
      where: { id: current.id },
      data: { sortOrder: otherOrder }
    });
    await tx.quickTransactionTemplate.update({
      where: { id: other.id },
      data: { sortOrder: currentOrder }
    });
  });

  revalidateQuickTemplateViews();
}

export async function deleteQuickTemplate(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  await prisma.quickTransactionTemplate.delete({ where: { id } });
  revalidateQuickTemplateViews();
}

function parseTemplateForm(formData: FormData): QuickTemplateInput {
  const type = parseType(formData.get("type"));
  const accountId = parseOptionalString(formData.get("accountId"));

  return {
    name: parseRequiredString(formData.get("name")),
    type,
    defaultAmount: parseOptionalAmount(formData.get("defaultAmount")),
    accountId,
    destinationAccountId:
      type === "transfer"
        ? parseRequiredString(formData.get("destinationAccountId"))
        : null,
    categoryId:
      type === "expense" ||
      type === "income" ||
      type === "reimbursable_expense"
        ? parseOptionalString(formData.get("categoryId"))
        : null,
    savingsBucketId:
      type === "savings_allocation"
        ? parseRequiredString(formData.get("savingsBucketId"))
        : null,
    defaultDescription: parseOptionalString(
      formData.get("defaultDescription")
    ),
    icon: parseOptionalString(formData.get("icon")),
    color: parseOptionalString(formData.get("color")),
    sortOrder: parseInteger(formData.get("sortOrder"), 0),
    isFavorite: formData.get("isFavorite") === "on",
    isActive: formData.get("isActive") === "on"
  };
}

function parseType(
  value: FormDataEntryValue | null
): QuickTransactionTemplateType {
  if (
    typeof value !== "string" ||
    !VALID_TYPES.has(value as QuickTransactionTemplateType)
  ) {
    throw new Error("Tipo de plantilla no válido.");
  }
  return value as QuickTransactionTemplateType;
}

function parseOptionalAmount(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe por defecto debe ser mayor que cero.");
  }
  return amount;
}

function parseInteger(
  value: FormDataEntryValue | null,
  fallback: number
): number {
  if (typeof value !== "string" || value.trim() === "") return fallback;
  const result = Number(value);
  if (!Number.isInteger(result)) throw new Error("El orden no es válido.");
  return result;
}

function parseRequiredString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Faltan datos obligatorios.");
  }
  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return value.trim();
}

function revalidateQuickTemplateViews(): void {
  revalidatePath("/");
  revalidatePath("/quick-templates");
}
