import {
  getQuickTransactionRules,
  type AccountBalanceDelta,
  type QuickTransactionRules
} from "./transaction-rules";

export type RecurringTransactionType =
  | "expense"
  | "income"
  | "transfer"
  | "savings_allocation";

export type RecurringTemplateForSchedule = {
  dayOfMonth: number;
  startDate: Date | string;
  endDate?: Date | string | null;
};

export type RecurringTransactionInput = {
  type: RecurringTransactionType;
  amount: number;
  accountId: string;
  destinationAccountId?: string | null;
  savingsBucketId?: string | null;
};

export type RecurringTransactionRules = QuickTransactionRules & {
  savingsBucketDelta: number;
};

export function getScheduledDate(
  year: number,
  month: number,
  dayOfMonth: number
): Date {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Año no válido.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mes no válido.");
  }

  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error("El día del mes debe estar entre 1 y 31.");
  }

  const lastDayOfMonth = new Date(year, month, 0).getDate();

  return new Date(year, month - 1, Math.min(dayOfMonth, lastDayOfMonth), 12);
}

export function shouldGenerateRecurringTransaction(
  template: RecurringTemplateForSchedule,
  year: number,
  month: number
): boolean {
  const scheduledDate = getScheduledDate(year, month, template.dayOfMonth);
  const startDate = startOfDay(new Date(template.startDate));
  const endDate = template.endDate
    ? endOfDay(new Date(template.endDate))
    : null;

  return scheduledDate >= startDate && (!endDate || scheduledDate <= endDate);
}

export function getNextScheduledDate(
  template: RecurringTemplateForSchedule,
  fromDate: Date = new Date()
): Date | null {
  const startDate = startOfDay(new Date(template.startDate));
  const endDate = template.endDate
    ? endOfDay(new Date(template.endDate))
    : null;
  const referenceDate =
    startDate > startOfDay(fromDate) ? startDate : startOfDay(fromDate);

  for (let offset = 0; offset < 240; offset += 1) {
    const candidateMonth = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() + offset,
      1,
      12
    );
    const candidate = getScheduledDate(
      candidateMonth.getFullYear(),
      candidateMonth.getMonth() + 1,
      template.dayOfMonth
    );

    if (candidate < referenceDate || candidate < startDate) {
      continue;
    }

    if (endDate && candidate > endDate) {
      return null;
    }

    return candidate;
  }

  return null;
}

export function getRecurringTransactionRules(
  input: RecurringTransactionInput
): RecurringTransactionRules {
  validateBaseInput(input);

  if (input.type === "savings_allocation") {
    return getQuickTransactionRules({
      ...input,
      savingsBucketId: input.savingsBucketId
    });
  }

  const rules = getQuickTransactionRules({
    type: input.type,
    amount: input.amount,
    accountId: input.accountId,
    destinationAccountId: input.destinationAccountId
  });

  return rules;
}

export function validateRecurringDateRange(
  startDate: Date,
  endDate: Date | null
): void {
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Fecha de inicio no válida.");
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    throw new Error("Fecha de fin no válida.");
  }

  if (endDate && endDate < startDate) {
    throw new Error("La fecha de fin no puede ser anterior al inicio.");
  }
}

function validateBaseInput(input: RecurringTransactionInput): void {
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }

  if (!input.accountId) {
    throw new Error("Selecciona una cuenta.");
  }
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999
  );
}

export type { AccountBalanceDelta };
