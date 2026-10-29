"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "utilitycalc:shared-engineering-assumptions:v1";

export function useSharedGasHhv(defaultValue: string) {
  const [value, setValue] = useState(defaultValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as { gasHhvMmbtuPerMcf?: string };
        if (parsed.gasHhvMmbtuPerMcf) setValue(parsed.gasHhvMmbtuPerMcf);
      }
    } catch {
      // Local storage is optional; calculations work without it.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ gasHhvMmbtuPerMcf: value }));
    } catch {
      // Ignore unavailable or full storage.
    }
  }, [ready, value]);

  return [value, setValue] as const;
}
