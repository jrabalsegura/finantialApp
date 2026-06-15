import { normalizeMoney } from "@/domain/money";

const eurCurrencyFormatter = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true
});

export function formatCurrencyEUR(value: number): string {
  return eurCurrencyFormatter.format(normalizeMoney(value));
}

export const currencyFormatter = {
  format: formatCurrencyEUR
};

export const shortDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric"
});

export const longDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric"
});

export const dayMonthFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short"
});

export const monthYearFormatter = new Intl.DateTimeFormat("es-ES", {
  month: "long",
  year: "numeric"
});

export const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function formatDateInputValue(date?: Date | null): string {
  if (!date) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
