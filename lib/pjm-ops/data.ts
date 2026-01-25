import { useEffect, useMemo, useRef, useState } from "react";

export type PjmOpsFeedItem = Record<string, unknown>;

export type FetchResult<T> = {
  data: T;
  latestTimestamp: string | null;
  sourceTimestamp?: string | null;
};

type CacheEntry<T> = {
  data: T;
  latestTimestamp: string | null;
  fetchedAt: number;
};

const cache = new Map<string, CacheEntry<unknown>>();

const ET_TIMEZONE = "America/New_York";

const dateKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ET_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const formatEt = new Intl.DateTimeFormat("en-US", {
  timeZone: ET_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatTimestampEt = (value: string | Date | null) => {
  if (!value) return "–";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "–";
  return formatEt.format(date);
};

export const formatTimeEt = (value: string | Date | null) => {
  if (!value) return "–";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "–";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const toEtDateKey = (value: string | Date | null) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return dateKeyFormatter.format(date);
};

export const parseRecordTimestamp = (record: PjmOpsFeedItem): Date | null => {
  const fields = [
    "datetime_beginning_utc",
    "datetime_ending_utc",
    "datetime_beginning_ept",
    "datetime_ending_ept",
    "datetime_beginning",
    "datetime_ending",
    "interval_start",
    "interval_end",
    "timestamp",
    "market_datetime",
    "market_date",
  ];
  for (const field of fields) {
    const value = record[field];
    if (!value || typeof value !== "string") continue;
    const candidate = value.endsWith("Z") ? value : value;
    const date = new Date(candidate);
    if (Number.isFinite(date.getTime())) return date;
  }
  return null;
};

export const asNumber = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[,\s]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
};

export const toEtTodayKey = () => toEtDateKey(new Date());

export type UseDatasetOptions<T> = {
  key: string;
  fetcher: () => Promise<FetchResult<T>>;
  cadenceMs: number;
  pollMs: number;
  ttlMs: number;
  enabled?: boolean;
};

export type DatasetState<T> = {
  data: T | null;
  latestTimestamp: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  isStale: boolean;
};

export const usePjmOpsDataset = <T,>({
  key,
  fetcher,
  cadenceMs,
  pollMs,
  ttlMs,
  enabled = true,
}: UseDatasetOptions<T>): DatasetState<T> => {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  const [state, setState] = useState<DatasetState<T>>(() => {
    if (cached) {
      return {
        data: cached.data,
        latestTimestamp: cached.latestTimestamp,
        status: "ready",
        error: null,
        isStale: false,
      };
    }
    return {
      data: null,
      latestTimestamp: null,
      status: enabled ? "loading" : "idle",
      error: null,
      isStale: false,
    };
  });

  const inflightRef = useRef(false);
  const lastFetchedRef = useRef(cached?.fetchedAt ?? 0);

  const evaluateStaleness = useMemo(() => {
    if (!state.latestTimestamp) return false;
    const ts = new Date(state.latestTimestamp);
    if (!Number.isFinite(ts.getTime())) return false;
    return Date.now() - ts.getTime() > cadenceMs * 2;
  }, [state.latestTimestamp, cadenceMs]);

  useEffect(() => {
    if (!enabled) return undefined;

    let mounted = true;

    const runFetch = async (force: boolean) => {
      if (inflightRef.current) return;
      const now = Date.now();
      if (!force && now - lastFetchedRef.current < ttlMs) return;
      inflightRef.current = true;
      setState((prev) => ({ ...prev, status: prev.data ? "ready" : "loading" }));
      try {
        const result = await fetcher();
        if (!mounted) return;
        lastFetchedRef.current = Date.now();
        const cachedEntry = cache.get(key) as CacheEntry<T> | undefined;
        const latestChanged = cachedEntry?.latestTimestamp !== result.latestTimestamp;
        if (!cachedEntry || latestChanged) {
          cache.set(key, {
            data: result.data,
            latestTimestamp: result.latestTimestamp,
            fetchedAt: lastFetchedRef.current,
          });
        }
        setState({
          data: result.data,
          latestTimestamp: result.latestTimestamp,
          status: "ready",
          error: null,
          isStale: false,
        });
      } catch (error) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          status: "error",
          error: error instanceof Error ? error.message : "Unable to load PJM data",
        }));
      } finally {
        inflightRef.current = false;
      }
    };

    runFetch(!cached);
    const interval = window.setInterval(() => runFetch(true), pollMs);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [enabled, fetcher, key, pollMs, ttlMs, cached]);

  useEffect(() => {
    setState((prev) => ({ ...prev, isStale: evaluateStaleness }));
  }, [evaluateStaleness]);

  return { ...state, isStale: evaluateStaleness };
};

export const fetchPjmOpsFeed = async (feed: string, params: Record<string, string> = {}) => {
  const search = new URLSearchParams({ feed, ...params });
  const response = await fetch(`/api/pjm-ops?${search.toString()}`);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with status ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.error) {
    throw new Error(payload.error);
  }
  return {
    data: payload as {
      items: PjmOpsFeedItem[];
      latestTimestamp: string | null;
      feed: string;
    },
    latestTimestamp: payload?.latestTimestamp ?? null,
  };
};
