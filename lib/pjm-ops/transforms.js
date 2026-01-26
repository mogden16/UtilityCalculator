// @ts-check

/**
 * @typedef {{ timestamp: Date, value: number }} NumericSeriesPoint
 */

/**
 * @typedef {{ value: number, timestamp: Date | null }} PeakPoint
 */

/**
 * @typedef {{ min: number | null, max: number | null }} MinMax
 */

/**
 * @typedef {{ timestamp: string, value: number }} EmissionsRecord
 */

/** @param {unknown} value @returns {number} */
const toNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;

/**
 * @param {NumericSeriesPoint[]} points
 * @returns {PeakPoint}
 */
export const computePeak = (points) => {
  if (!points.length) {
    return { value: Number.NaN, timestamp: null };
  }
  /** @type {PeakPoint} */
  const initial = { value: Number.NaN, timestamp: null };
  return points.reduce(
    (best, point) => {
      if (!Number.isFinite(point.value)) return best;
      if (!Number.isFinite(best.value) || point.value > best.value) {
        return { value: point.value, timestamp: point.timestamp };
      }
      return best;
    },
    initial
  );
};

/**
 * @param {NumericSeriesPoint[]} points
 * @returns {MinMax}
 */
export const computeMinMax = (points) => {
  if (!points.length) {
    return { min: null, max: null };
  }
  let min = null;
  let max = null;
  for (const point of points) {
    const value = toNumber(point.value);
    if (!Number.isFinite(value)) continue;
    min = min === null ? value : Math.min(min, value);
    max = max === null ? value : Math.max(max, value);
  }
  return { min, max };
};

/**
 * @param {number[]} values
 * @returns {number}
 */
const median = (values) => {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

/**
 * @param {EmissionsRecord[]} records
 * @returns {NumericSeriesPoint[]}
 */
export const aggregateEmissionsMedian = (records) => {
  if (!records.length) return [];
  const buckets = new Map();
  for (const record of records) {
    if (!record.timestamp) continue;
    if (!Number.isFinite(record.value)) continue;
    const bucket = buckets.get(record.timestamp) ?? [];
    bucket.push(record.value);
    buckets.set(record.timestamp, bucket);
  }
  return Array.from(buckets.entries())
    .map(([timestamp, values]) => ({
      timestamp: new Date(timestamp),
      value: median(values),
    }))
    .filter((point) => Number.isFinite(point.timestamp.getTime()))
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
};
