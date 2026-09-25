"use server";

import type { CategoryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { withErrorFeedback } from "@/lib/action-feedback";
import { requireCurrentUser } from "@/lib/auth";
import {
  parseEnum,
  parseOptionalString,
  parseRequiredString
} from "@/lib/form-data";
import { prisma } from "@/lib/prisma";

const CATEGORY_TYPES: CategoryType[] = ["expense", "income", "both"];

export const createCategory = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
  const input = parseCategoryForm(formData);

  await prisma.category.create({
    data: input
  });

  revalidateCategoryViews();
});

export const updateCategory = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
  const id = parseRequiredString(formData.get("id"));
  const input = parseCategoryForm(formData);

  await prisma.$transaction(async (tx) => {
    if (input.type !== "both") {
      const opposite = input.type === "expense" ? "income" : "expense";
      const [recurring, templates, transactions] = await Promise.all([
        tx.recurringTransaction.count({
          where: { categoryId: id, type: opposite }
        }),
        tx.quickTransactionTemplate.count({
          where: {
            categoryId: id,
            type: {
              in:
                opposite === "expense"
                  ? ["expense", "reimbursable_expense"]
                  : ["income"]
            }
          }
        }),
        tx.transaction.count({
          where: {
            categoryId: id,
            ...(opposite === "expense"
              ? { affectsPersonalExpense: true }
              : { affectsPersonalIncome: true })
          }
        })
      ]);
      if (recurring + templates + transactions > 0)
        throw new Error(
          "Esta categoría tiene movimientos o plantillas incompatibles. Usa el tipo Ambos o reasigna sus referencias primero."
        );
    }
    await tx.category.update({ where: { id }, data: input });
  });

  revalidateCategoryViews();
});

export const deleteCategory = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
  const id = parseRequiredString(formData.get("id"));

  const [transactions, recurringTransactions, quickTransactionTemplates] =
    await Promise.all([
      prisma.transaction.count({ where: { categoryId: id } }),
      prisma.recurringTransaction.count({ where: { categoryId: id } }),
      prisma.quickTransactionTemplate.count({ where: { categoryId: id } })
    ]);

  if (
    transactions > 0 ||
    recurringTransactions > 0 ||
    quickTransactionTemplates > 0
  ) {
    throw new Error(
      "No se puede eliminar una categoría usada por movimientos o plantillas."
    );
  }

  await prisma.category.delete({ where: { id } });

  revalidateCategoryViews();
});

function parseCategoryForm(formData: FormData) {
  return {
    color: parseOptionalString(formData.get("color")),
    icon: parseOptionalString(formData.get("icon")),
    name: parseRequiredString(formData.get("name")),
    type: parseEnum(
      formData.get("type"),
      CATEGORY_TYPES,
      "Tipo de categoría no válido."
    )
  };
}

function revalidateCategoryViews(): void {
  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/quick-templates");
  revalidatePath("/recurring");
}
