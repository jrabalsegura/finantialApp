"use server";

import { revalidatePath } from "next/cache";
import { QUICK_TRANSACTION_TYPES } from "@/domain/domain-options";
import { withErrorFeedback } from "@/lib/action-feedback";
import { requireCurrentUser } from "@/lib/auth";
import {
  parseAmount,
  parseCheckbox,
  parseEnum,
  parseOptionalInteger,
  parseOptionalString,
  parseRequiredString
} from "@/lib/form-data";
import { prisma } from "@/lib/prisma";
import {
  createQuickTemplate,
  updateQuickTemplate,
  type QuickTemplateInput
} from "@/lib/quick-transaction-templates";

export const createQuickTemplateAction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    await createQuickTemplate(parseTemplateForm(formData));
    revalidateQuickTemplateViews();
  }
);

export const updateQuickTemplateAction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    await updateQuickTemplate(id, parseTemplateForm(formData));
    revalidateQuickTemplateViews();
  }
);

export const toggleQuickTemplateActive = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    const isActive = formData.get("isActive") === "true";
    await prisma.quickTransactionTemplate.update({
      where: { id },
      data: { isActive }
    });
    revalidateQuickTemplateViews();
  }
);

export const toggleQuickTemplateFavorite = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    const isFavorite = formData.get("isFavorite") === "true";
    await prisma.quickTransactionTemplate.update({
      where: { id },
      data: { isFavorite }
    });
    revalidateQuickTemplateViews();
  }
);

export const moveQuickTemplate = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
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
);

export const deleteQuickTemplate = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    await prisma.quickTransactionTemplate.delete({ where: { id } });
    revalidateQuickTemplateViews();
  }
);

function parseTemplateForm(formData: FormData): QuickTemplateInput {
  const type = parseEnum(
    formData.get("type"),
    QUICK_TRANSACTION_TYPES,
    "Tipo de plantilla no válido."
  );
  const accountId = parseOptionalString(formData.get("accountId"));

  return {
    name: parseRequiredString(formData.get("name")),
    type,
    defaultAmount: parseOptionalString(formData.get("defaultAmount"))
      ? parseAmount(formData.get("defaultAmount"))
      : null,
    accountId,
    destinationAccountId:
      type === "transfer"
        ? parseRequiredString(formData.get("destinationAccountId"))
        : null,
    categoryId:
      type === "expense" || type === "income" || type === "reimbursable_expense"
        ? parseOptionalString(formData.get("categoryId"))
        : null,
    savingsBucketId:
      type === "savings_allocation"
        ? parseRequiredString(formData.get("savingsBucketId"))
        : null,
    defaultDescription: parseOptionalString(formData.get("defaultDescription")),
    icon: parseOptionalString(formData.get("icon")),
    color: parseOptionalString(formData.get("color")),
    sortOrder:
      parseOptionalInteger(
        formData.get("sortOrder"),
        "El orden no es válido."
      ) ?? 0,
    isFavorite: parseCheckbox(formData.get("isFavorite")),
    isActive: parseCheckbox(formData.get("isActive"))
  };
}

function revalidateQuickTemplateViews(): void {
  revalidatePath("/");
  revalidatePath("/quick-templates");
}
