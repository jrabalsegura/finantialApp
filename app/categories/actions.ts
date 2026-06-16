"use server";

import { revalidatePath } from "next/cache";
import type { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const VALID_CATEGORY_TYPES = new Set<CategoryType>([
  "expense",
  "income",
  "both"
]);

export async function createCategory(formData: FormData): Promise<void> {
  const input = parseCategoryForm(formData);

  await prisma.category.create({
    data: input
  });

  revalidateCategoryViews();
}

export async function updateCategory(formData: FormData): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const input = parseCategoryForm(formData);

  await prisma.category.update({
    where: { id },
    data: input
  });

  revalidateCategoryViews();
}

export async function deleteCategory(formData: FormData): Promise<void> {
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
}

function parseCategoryForm(formData: FormData) {
  return {
    color: parseOptionalString(formData.get("color")),
    icon: parseOptionalString(formData.get("icon")),
    name: parseRequiredString(formData.get("name")),
    type: parseCategoryType(formData.get("type"))
  };
}

function parseCategoryType(value: FormDataEntryValue | null): CategoryType {
  if (
    typeof value !== "string" ||
    !VALID_CATEGORY_TYPES.has(value as CategoryType)
  ) {
    throw new Error("Tipo de categoría no válido.");
  }

  return value as CategoryType;
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : null;
}

function parseRequiredString(value: FormDataEntryValue | null): string {
  const parsedValue = parseOptionalString(value);

  if (!parsedValue) {
    throw new Error("Completa todos los campos obligatorios.");
  }

  return parsedValue;
}

function revalidateCategoryViews(): void {
  revalidatePath("/");
  revalidatePath("/categories");
  revalidatePath("/quick-templates");
  revalidatePath("/recurring");
}
