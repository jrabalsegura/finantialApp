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

export type RecurringFrequency = "monthly" | "weekly";

export type RecurringTemplateForSchedule = {
  dayOfMonth: number;
  dayOfWeek?: number;
  frequency?: RecurringFrequency;
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

export function getCalendarDayRange(date: Date): {
  start: Date;
  end: Date;
} {
  if (Number.isNaN(date.getTime())) {
    throw new Error("Fecha no válida.");
  }

  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
}

export function shouldGenerateRecurringTransaction(
  template: RecurringTemplateForSchedule,
  year: number,
  month: number
): boolean {
  return getScheduledDatesForMonth(template, year, month).length > 0;
}

export function getScheduledDatesForMonth(
  template: RecurringTemplateForSchedule,
  year: number,
  month: number
): Date[] {
  validateYearAndMonth(year, month);

  const startDate = startOfDay(new Date(template.startDate));
  const endDate = template.endDate
    ? endOfDay(new Date(template.endDate))
    : null;

  if ((template.frequency ?? "monthly") === "monthly") {
    const scheduledDate = getScheduledDate(year, month, template.dayOfMonth);
    return isDateInActiveRange(scheduledDate, startDate, endDate)
      ? [scheduledDate]
      : [];
  }

  const dayOfWeek = template.dayOfWeek ?? 1;
  validateDayOfWeek(dayOfWeek);
  const dates: Date[] = [];
  const lastDay = new Date(year, month, 0).getDate();

  for (let day = 1; day <= lastDay; day += 1) {
    const candidate = new Date(year, month - 1, day, 12);
    if (
      toIsoDayOfWeek(candidate) === dayOfWeek &&
      isDateInActiveRange(candidate, startDate, endDate)
    ) {
      dates.push(candidate);
    }
  }

  return dates;
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
    const candidates = getScheduledDatesForMonth(
      template,
      candidateMonth.getFullYear(),
      candidateMonth.getMonth() + 1
    );

    for (const candidate of candidates) {
      if (candidate >= referenceDate && candidate >= startDate) {
        return candidate;
      }
    }

    if (endDate && candidateMonth > endDate) return null;
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

function validateYearAndMonth(year: number, month: number): void {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Año no válido.");
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Mes no válido.");
  }
}

function validateDayOfWeek(dayOfWeek: number): void {
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
    throw new Error("El día de la semana debe estar entre lunes y domingo.");
  }
}

function isDateInActiveRange(
  date: Date,
  startDate: Date,
  endDate: Date | null
): boolean {
  return date >= startDate && (!endDate || date <= endDate);
}

function toIsoDayOfWeek(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
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
