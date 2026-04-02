export function parseNumberish(value: number | string): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const sanitized = value.replace(/[,\s]/g, "").trim();
  if (!sanitized) {
    return 0;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseFiniteOrNaN(value: string): number {
  const sanitized = value.replace(/,/g, "").trim();
  if (!sanitized) {
    return Number.NaN;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}
