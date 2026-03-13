/**
 * DataCacheContext
 * ─────────────────────────────────────────────────────────────
 * Global in-memory cache for all API responses.
 * Data fetched once is stored here — navigating back to a page
 * returns instantly from cache instead of hitting the API again.
 *
 * Usage in any page:
 *   const { get, prefetch } = useDataCache()
 *   const data = await get("/api/data/summary")
 *
 * Files:
 *   src/lib/DataCacheContext.tsx   ← this file
 *   src/app/dashboard/layout.tsx   ← wraps all dashboard pages + prefetches on mount
 */
"use client";
import {
  createContext,
  useContext,
  useRef,
  useCallback,
  ReactNode,
} from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────
type CacheEntry = {
  data: any;
  fetchedAt: number; // Date.now()
  status: "ok" | "error";
};

type InFlight = Promise<any>;

type CacheContextValue = {
  /** Fetch a URL — returns from cache if already loaded, otherwise fetches */
  get: (url: string, ttlMs?: number) => Promise<any>;
  /** Fire-and-forget prefetch — useful in layout to warm cache */
  prefetch: (url: string) => void;
  /** Read current cache state (for debug / loading indicators) */
  peek: (url: string) => CacheEntry | null;
  /** Force-invalidate a cache entry */
  bust: (url: string) => void;
  /** True if a key is already cached */
  isCached: (url: string) => boolean;
};

const DataCacheContext = createContext<CacheContextValue | null>(null);

// Default TTL: 5 minutes — pages stay fresh for a session
const DEFAULT_TTL = 5 * 60 * 1000;

// ── Provider ──────────────────────────────────────────────────
export function DataCacheProvider({ children }: { children: ReactNode }) {
  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const inFlight = useRef<Map<string, InFlight>>(new Map());

  const get = useCallback(
    async (url: string, ttlMs = DEFAULT_TTL): Promise<any> => {
      const fullUrl = url.startsWith("http") ? url : `${API}${url}`;
      const now = Date.now();

      // Return from cache if fresh
      const cached = cache.current.get(fullUrl);
      if (cached && now - cached.fetchedAt < ttlMs) {
        return cached.data;
      }

      // Deduplicate in-flight requests — if same URL already fetching, wait for it
      if (inFlight.current.has(fullUrl)) {
        return inFlight.current.get(fullUrl);
      }

      // New fetch
      const promise = fetch(fullUrl)
        .then((r) => r.json())
        .then((data) => {
          cache.current.set(fullUrl, {
            data,
            fetchedAt: Date.now(),
            status: "ok",
          });
          inFlight.current.delete(fullUrl);
          return data;
        })
        .catch((err) => {
          inFlight.current.delete(fullUrl);
          throw err;
        });

      inFlight.current.set(fullUrl, promise);
      return promise;
    },
    [],
  );

  const prefetch = useCallback(
    (url: string) => {
      const fullUrl = url.startsWith("http") ? url : `${API}${url}`;
      if (!cache.current.has(fullUrl) && !inFlight.current.has(fullUrl)) {
        get(fullUrl).catch(() => {}); // fire and forget — errors silently
      }
    },
    [get],
  );

  const peek = useCallback((url: string): CacheEntry | null => {
    const fullUrl = url.startsWith("http") ? url : `${API}${url}`;
    return cache.current.get(fullUrl) ?? null;
  }, []);

  const bust = useCallback((url: string) => {
    const fullUrl = url.startsWith("http") ? url : `${API}${url}`;
    cache.current.delete(fullUrl);
  }, []);

  const isCached = useCallback((url: string): boolean => {
    const fullUrl = url.startsWith("http") ? url : `${API}${url}`;
    const entry = cache.current.get(fullUrl);
    if (!entry) return false;
    return Date.now() - entry.fetchedAt < DEFAULT_TTL;
  }, []);

  return (
    <DataCacheContext.Provider value={{ get, prefetch, peek, bust, isCached }}>
      {children}
    </DataCacheContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────
export function useDataCache(): CacheContextValue {
  const ctx = useContext(DataCacheContext);
  if (!ctx)
    throw new Error("useDataCache must be used inside DataCacheProvider");
  return ctx;
}

export default DataCacheContext;
