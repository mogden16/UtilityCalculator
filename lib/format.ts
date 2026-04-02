export function formatWhole(value: number): string {
  return Number.isFinite(value) ? Math.round(value).toLocaleString() : "-";
}

export function formatFixed(value: number, digits = 1): string {
  return Number.isFinite(value)
    ? value.toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })
    : "-";
}

export function formatCurrency(value: number): string {
  return Number.isFinite(value)
    ? `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "-";
}
