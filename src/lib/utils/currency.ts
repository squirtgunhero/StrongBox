import Decimal from "decimal.js";

/**
 * Format a Decimal as USD currency string
 */
export function formatCurrency(value: Decimal | number | string): string {
  const num =
    value instanceof Decimal ? value.toNumber() : Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format a Decimal as a compact currency string (e.g., $1.2M)
 */
export function formatCurrencyCompact(
  value: Decimal | number | string
): string {
  const num =
    value instanceof Decimal ? value.toNumber() : Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

/**
 * Format a percentage (e.g., 12.5 → "12.50%")
 */
export function formatPercent(value: Decimal | number | string): string {
  const num =
    value instanceof Decimal ? value.toNumber() : Number(value);
  return `${num.toFixed(2)}%`;
}
