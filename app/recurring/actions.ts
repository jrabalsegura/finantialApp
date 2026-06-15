"use server";

import {
  RecurringAutoCreateMode,
  RecurringFrequency,
  RecurringTransactionType,
  type Prisma
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  getRecurringTransactionRules,
  validateRecurringDateRange
} from "@/domain/recurring-transactions";
import {
  confirmAllRecurringOccurrences,
  confirmRecurringOccurrence,
  skipRecurringOccurrence
} from "@/lib/recurring-transactions";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = new Set<RecurringTransactionType>([
  "expense",
  "income",
  "transfer",
  "savings_allocation"
]);
const VALID_MODES = new Set<RecurringAutoCreateMode>([
  "pending",
  "automatic"
]);
const VALID_FREQUENCIES = new Set<RecurringFrequency>([
  "monthly",
  "weekly"
]);

export async function createRecurringTransaction(
  formData: FormData
): Promise<void> {
  const input = parseRecurringTransactionForm(formData);

  await prisma.$transaction(async (tx) => {
    await validateRecurringRelations(tx, input);
    await tx.recurringTransaction.create({ data: input });
  });

  revalidateRecurringViews();
}

export async function updateRecurringTransaction(
  formData: FormData
): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const input = parseRecurringTransactionForm(formData);

  await prisma.$transaction(async (tx) => {
    await validateRecurringRelations(tx, input);
    await tx.recurringTransaction.update({
      where: { id },
      data: input
    });
  });

  revalidateRecurringViews();
}

export async function toggleRecurringTransaction(
  formData: FormData
): Promise<void> {
  const id = parseRequiredString(formData.get("id"));
  const isActive = formData.get("isActive") === "true";

  await prisma.recurringTransaction.update({
    where: { id },
    data: { isActive }
  });

  revalidateRecurringViews();
}

export async function deleteRecurringTransaction(
  formData: FormData
): Promise<void> {
  const id = parseRequiredString(formData.get("id"));

  await prisma.recurringTransaction.delete({ where: { id } });
  revalidateRecurringViews();
}

export async function confirmOccurrence(formData: FormData): Promise<void> {
  const occurrenceId = parseRequiredString(formData.get("occurrenceId"));

  await confirmRecurringOccurrence(occurrenceId);
  revalidateRecurringViews();
}

export async function editAndConfirmOccurrence(
  formData: FormData
): Promise<void> {
  const occurrenceId = parseRequiredString(formData.get("occurrenceId"));
  const amount = parseAmount(formData.get("amount"));
  const date = parseDate(formData.get("date"));

  await confirmRecurringOccurrence(occurrenceId, { amount, date });
  revalidateRecurringViews();
}

export async function skipOccurrence(formData: FormData): Promise<void> {
  const occurrenceId = parseRequiredString(formData.get("occurrenceId"));

  await skipRecurringOccurrence(occurrenceId);
  revalidateRecurringViews();
}

export async function confirmAllOccurrences(formData: FormData): Promise<void> {
  const year = parseInteger(formData.get("year"), "Año no válido.");
  const month = parseInteger(formData.get("month"), "Mes no válido.");

  if (month < 1 || month > 12) {
    throw new Error("Mes no válido.");
  }

  await confirmAllRecurringOccurrences(year, month);
  revalidateRecurringViews();
}

function parseRecurringTransactionForm(formData: FormData) {
  const name = parseRequiredString(formData.get("name"));
  const type = parseType(formData.get("type"));
  const amount = parseAmount(formData.get("amount"));
  const accountId = parseRequiredString(formData.get("accountId"));
  const destinationAccountId =
    type === "transfer"
      ? parseRequiredString(formData.get("destinationAccountId"))
      : null;
  const categoryId =
    type === "expense" || type === "income"
      ? parseOptionalString(formData.get("categoryId"))
      : null;
  const savingsBucketId =
    type === "savings_allocation"
      ? parseRequiredString(formData.get("savingsBucketId"))
      : null;
  const description = parseOptionalString(formData.get("description"));
  const frequency = parseFrequency(formData.get("frequency"));
  const dayOfMonth =
    frequency === "monthly"
      ? parseInteger(formData.get("dayOfMonth"), "Día del mes no válido.")
      : 1;
  const dayOfWeek =
    frequency === "weekly"
      ? parseInteger(
          formData.get("dayOfWeek"),
          "Día de la semana no válido."
        )
      : 1;
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseOptionalDate(formData.get("endDate"));
  const isActive = formData.get("isActive") === "on";
  const autoCreateMode = parseMode(formData.get("autoCreateMode"));

  if (dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error("El día del mes debe estar entre 1 y 31.");
  }
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("El día de la semana no es válido.");
  }
  if (
    frequency === "weekly" &&
    type !== "expense" &&
    type !== "income"
  ) {
    throw new Error(
      "La frecuencia semanal solo está disponible para gastos e ingresos."
    );
  }

  validateRecurringDateRange(startDate, endDate);
  getRecurringTransactionRules({
    type,
    amount,
    accountId,
    destinationAccountId,
    savingsBucketId
  });

  return {
    name,
    type,
    amount,
    accountId,
    destinationAccountId,
    categoryId,
    savingsBucketId,
    description,
    frequency,
    dayOfMonth,
    dayOfWeek,
    startDate,
    endDate,
    isActive,
    autoCreateMode
  };
}

async function validateRecurringRelations(
  tx: Prisma.TransactionClient,
  input: ReturnType<typeof parseRecurringTransactionForm>
): Promise<void> {
  const account = await tx.account.findUnique({
    where: { id: input.accountId },
    select: { id: true }
  });

  if (!account) {
    throw new Error("La cuenta seleccionada no existe.");
  }

  if (input.type === "transfer") {
    if (input.destinationAccountId === input.accountId) {
      throw new Error("La cuenta de destino debe ser distinta.");
    }

    const destination = await tx.account.findUnique({
      where: { id: input.destinationAccountId as string },
      select: { id: true }
    });

    if (!destination) {
      throw new Error("La cuenta de destino no existe.");
    }
  }

  if (input.categoryId) {
    const category = await tx.category.findUnique({
      where: { id: input.categoryId },
      select: { type: true }
    });

    if (
      !category ||
      (category.type !== "both" && category.type !== input.type)
    ) {
      throw new Error("La categoría no corresponde al tipo de movimiento.");
    }
  }

  if (input.savingsBucketId) {
    const savingsBucket = await tx.savingsBucket.findUnique({
      where: { id: input.savingsBucketId },
      select: { id: true }
    });

    if (!savingsBucket) {
      throw new Error("La partida de ahorro no existe.");
    }
  }
}

function parseType(value: FormDataEntryValue | null): RecurringTransactionType {
  if (
    typeof value !== "string" ||
    !VALID_TYPES.has(value as RecurringTransactionType)
  ) {
    throw new Error("Tipo de movimiento recurrente no válido.");
  }

  return value as RecurringTransactionType;
}

function parseMode(value: FormDataEntryValue | null): RecurringAutoCreateMode {
  if (
    typeof value !== "string" ||
    !VALID_MODES.has(value as RecurringAutoCreateMode)
  ) {
    throw new Error("Modo de creación no válido.");
  }

  return value as RecurringAutoCreateMode;
}

function parseFrequency(
  value: FormDataEntryValue | null
): RecurringFrequency {
  if (
    typeof value !== "string" ||
    !VALID_FREQUENCIES.has(value as RecurringFrequency)
  ) {
    throw new Error("Frecuencia recurrente no válida.");
  }

  return value as RecurringFrequency;
}

function parseAmount(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") {
    throw new Error("Introduce un importe.");
  }

  const amount = Number(value.replace(",", ".").trim());

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }

  return amount;
}

function parseInteger(
  value: FormDataEntryValue | null,
  errorMessage: string
): number {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(errorMessage);
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(errorMessage);
  }

  return parsed;
}

function parseRequiredString(value: FormDataEntryValue | null): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Faltan datos obligatorios.");
  }

  return value.trim();
}

function parseOptionalString(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

function parseDate(value: FormDataEntryValue | null): Date {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Fecha no válida.");
  }

  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha no válida.");
  }

  return date;
}

function parseOptionalDate(value: FormDataEntryValue | null): Date | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  return parseDate(value);
}

function revalidateRecurringViews(): void {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/monthly-close");
  revalidatePath("/recurring");
  revalidatePath("/savings");
  revalidatePath("/weekly-budget");
}
