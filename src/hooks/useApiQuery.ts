"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/utils/http";

const MAX_ENTRIES = 50;
const cache = new Map<string, unknown>();

function remember(url: string, data: unknown) {
  cache.set(url, data);
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
}

export interface QueryState<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
}

type Settled<T> = { url: string; data?: T; error?: Error };

/**
 * Fetches an `/api/*` JSON envelope with abort-on-change and a small
 * session cache. Pass `null` to stay idle. Loading state is derived rather
 * than stored, so a stale response can never be shown for a newer URL.
 */
export function useApiQuery<T>(url: string | null): QueryState<T> {
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!url || cache.has(url)) return;
    const controller = new AbortController();

    fetchJson<T>(url, controller.signal)
      .then((data) => {
        remember(url, data);
        setSettled({ url, data });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setSettled({ url, error });
      });

    return () => controller.abort();
  }, [url]);

  if (!url) return { data: undefined, error: undefined, isLoading: false };
  if (cache.has(url)) return { data: cache.get(url) as T, error: undefined, isLoading: false };

  const current = settled?.url === url ? settled : null;
  return { data: current?.data, error: current?.error, isLoading: !current };
}
