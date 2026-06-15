export function normalizeMoney(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  const sign = value < 0 ? -1 : 1;
  return sign * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100;
}

export function parseMoneyInput(value: string): number {
  const compactValue = value
    .trim()
    .replace(/\s/g, "")
    .replace(/€/g, "");

  if (!compactValue) {
    return Number.NaN;
  }

  const commaIndex = compactValue.lastIndexOf(",");
  const dotIndex = compactValue.lastIndexOf(".");
  const decimalIndex = Math.max(commaIndex, dotIndex);
  const hasBothSeparators = commaIndex >= 0 && dotIndex >= 0;
  const integerPart =
    decimalIndex >= 0 ? compactValue.slice(0, decimalIndex) : compactValue;
  const fractionPart =
    decimalIndex >= 0 ? compactValue.slice(decimalIndex + 1) : "";
  const normalizedInteger = hasBothSeparators
    ? integerPart.replace(/[.,]/g, "")
    : integerPart;
  const normalizedValue =
    decimalIndex >= 0
      ? `${normalizedInteger}.${fractionPart}`
      : normalizedInteger;
  const parsedValue = Number(normalizedValue);

  return Number.isFinite(parsedValue)
    ? normalizeMoney(parsedValue)
    : Number.NaN;
}

export function formatPlainAmount(value: number): string {
  return normalizeMoney(value).toFixed(2);
}
