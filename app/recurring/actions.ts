"use server";

import type {
  Prisma,
  RecurringAutoCreateMode,
  RecurringFrequency
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { RECURRING_TRANSACTION_TYPES } from "@/domain/domain-options";
import {
  getRecurringTransactionRules,
  validateRecurringDateRange
} from "@/domain/recurring-transactions";
import { withErrorFeedback } from "@/lib/action-feedback";
import { requireCurrentUser } from "@/lib/auth";
import {
  parseAmount,
  parseCheckbox,
  parseDate,
  parseEnum,
  parseInteger,
  parseOptionalDate,
  parseOptionalString,
  parseRequiredString
} from "@/lib/form-data";
import {
  confirmAllRecurringOccurrences,
  confirmRecurringOccurrence,
  skipRecurringOccurrence,
  reconcilePendingOccurrences
} from "@/lib/recurring-transactions";
import { prisma } from "@/lib/prisma";

const MODES: RecurringAutoCreateMode[] = ["pending", "automatic"];
const FREQUENCIES: RecurringFrequency[] = ["monthly", "weekly"];

export const createRecurringTransaction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const input = parseRecurringTransactionForm(formData);

    await prisma.$transaction(async (tx) => {
      await validateRecurringRelations(tx, input);
      await tx.recurringTransaction.create({ data: input });
    });

    revalidateRecurringViews();
  }
);

export const updateRecurringTransaction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    const input = parseRecurringTransactionForm(formData);

    await prisma.$transaction(async (tx) => {
      const previous = await tx.recurringTransaction.findUniqueOrThrow({
        where: { id }
      });
      if (
        previous.type !== input.type &&
        (await tx.recurringTransactionOccurrence.count({
          where: { recurringTransactionId: id, status: { not: "pending" } }
        }))
      )
        throw new Error(
          "La plantilla tiene historial. Crea otra para cambiar el tipo de movimiento."
        );
      await validateRecurringRelations(tx, input);
      await tx.recurringTransaction.update({
        where: { id },
        data: input
      });
      await reconcilePendingOccurrences(tx, id);
    });

    revalidateRecurringViews();
  }
);

export const toggleRecurringTransaction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));
    const isActive = formData.get("isActive") === "true";

    await prisma.$transaction(async (tx) => {
      await tx.recurringTransaction.update({
        where: { id },
        data: { isActive }
      });
      await reconcilePendingOccurrences(tx, id);
    });

    revalidateRecurringViews();
  }
);

export const deleteRecurringTransaction = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const id = parseRequiredString(formData.get("id"));

    await prisma.$transaction(async (tx) => {
      const count = await tx.recurringTransactionOccurrence.count({
        where: { recurringTransactionId: id, status: { not: "pending" } }
      });
      if (count > 0)
        throw new Error(
          "Esta plantilla tiene historial. Desactívala para conservar sus movimientos e informes."
        );
      await tx.recurringTransaction.delete({ where: { id } });
    });
    revalidateRecurringViews();
  }
);

export const confirmOccurrence = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const occurrenceId = parseRequiredString(formData.get("occurrenceId"));

    await confirmRecurringOccurrence(occurrenceId);
    revalidateRecurringViews();
  }
);

export const editAndConfirmOccurrence = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const occurrenceId = parseRequiredString(formData.get("occurrenceId"));
    const amount = parseAmount(formData.get("amount"));
    const date = parseDate(formData.get("date"));

    await confirmRecurringOccurrence(occurrenceId, { amount, date });
    revalidateRecurringViews();
  }
);

export const skipOccurrence = withErrorFeedback(async (formData: FormData) => {
  await requireCurrentUser();
  const occurrenceId = parseRequiredString(formData.get("occurrenceId"));

  await skipRecurringOccurrence(occurrenceId);
  revalidateRecurringViews();
});

export const confirmAllOccurrences = withErrorFeedback(
  async (formData: FormData) => {
    await requireCurrentUser();
    const year = parseInteger(formData.get("year"), "Año no válido.");
    const month = parseInteger(formData.get("month"), "Mes no válido.");

    if (month < 1 || month > 12) {
      throw new Error("Mes no válido.");
    }

    await confirmAllRecurringOccurrences(year, month);
    revalidateRecurringViews();
  }
);

function parseRecurringTransactionForm(formData: FormData) {
  const name = parseRequiredString(formData.get("name"));
  const type = parseEnum(
    formData.get("type"),
    RECURRING_TRANSACTION_TYPES,
    "Tipo de movimiento recurrente no válido."
  );
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
  const frequency = parseEnum(
    formData.get("frequency"),
    FREQUENCIES,
    "Frecuencia recurrente no válida."
  );
  const dayOfMonth =
    frequency === "monthly"
      ? parseInteger(formData.get("dayOfMonth"), "Día del mes no válido.")
      : 1;
  const dayOfWeek =
    frequency === "weekly"
      ? parseInteger(formData.get("dayOfWeek"), "Día de la semana no válido.")
      : 1;
  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseOptionalDate(formData.get("endDate"));
  const isActive = parseCheckbox(formData.get("isActive"));
  const autoCreateMode = parseEnum(
    formData.get("autoCreateMode"),
    MODES,
    "Modo de creación no válido."
  );

  if (dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error("El día del mes debe estar entre 1 y 31.");
  }
  if (dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("El día de la semana no es válido.");
  }
  if (frequency === "weekly" && type !== "expense" && type !== "income") {
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
      select: { id: true, isLongTerm: true }
    });

    if (!savingsBucket) {
      throw new Error("La partida de ahorro no existe.");
    }

    if (savingsBucket.isLongTerm) {
      throw new Error(
        "La partida Largo plazo se calcula desde cuentas y no admite asignaciones recurrentes."
      );
    }
  }
}

function revalidateRecurringViews(): void {
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/monthly-close");
  revalidatePath("/recurring");
  revalidatePath("/savings");
  revalidatePath("/weekly-budget");
}
