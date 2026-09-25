import { parseMoneyInput } from "@/domain/money";

type FormValue = FormDataEntryValue | null;

export function parseOptionalString(value: FormValue): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function parseRequiredString(value: FormValue): string {
  const parsed = parseOptionalString(value);
  if (!parsed) throw new Error("Faltan datos obligatorios.");
  return parsed;
}

export function parseCheckbox(value: FormValue): boolean {
  return value === "on";
}

export function parseEnum<T extends string>(
  value: FormValue,
  allowed: readonly T[],
  errorMessage: string
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(errorMessage);
  }
  return value as T;
}

export function parseInteger(value: FormValue, errorMessage: string): number {
  const parsed =
    typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isInteger(parsed)) throw new Error(errorMessage);
  return parsed;
}

export function parseOptionalInteger(
  value: FormValue,
  errorMessage: string
): number | null {
  return parseOptionalString(value) === null
    ? null
    : parseInteger(value, errorMessage);
}

/** Strictly positive amount. */
export function parseAmount(value: FormValue): number {
  if (typeof value !== "string") throw new Error("Introduce un importe.");
  const amount = parseMoneyInput(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("El importe debe ser mayor que cero.");
  }
  return amount;
}

/** Any finite amount; empty input counts as zero. */
export function parseAmountAllowingZero(value: FormValue): number {
  if (parseOptionalString(value) === null) return 0;
  const amount = parseMoneyInput(value as string);
  if (!Number.isFinite(amount)) {
    throw new Error("El importe debe ser un número válido.");
  }
  return amount;
}

export function parseNonNegativeAmount(value: FormValue): number {
  const amount = parseAmountAllowingZero(value);
  if (amount < 0) throw new Error("El importe no puede ser negativo.");
  return amount;
}

export function parseOptionalNonNegativeAmount(
  value: FormValue
): number | null {
  return parseOptionalString(value) === null
    ? null
    : parseNonNegativeAmount(value);
}

/** `YYYY-MM-DD` at local noon, so the business date survives any UTC offset. */
export function parseDate(value: FormValue): Date {
  const date =
    typeof value === "string" && value.trim()
      ? new Date(`${value.trim()}T12:00:00`)
      : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new Error("Fecha no válida.");
  return date;
}

export function parseOptionalDate(value: FormValue): Date | null {
  return parseOptionalString(value) === null ? null : parseDate(value);
}

export function parseDateOrNow(value: FormValue): Date {
  return parseOptionalString(value) === null ? new Date() : parseDate(value);
}
