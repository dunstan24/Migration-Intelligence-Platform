/**
 * Dashboard layout — wraps every page under /dashboard
 * - Provides DataCacheProvider (global in-memory cache)
 * - Prefetches all heavy endpoints on first mount
 *   so by the time user clicks a nav link, data is already ready
 *
 * src/app/dashboard/layout.tsx
 */
"use client";
import { useEffect } from "react";
import TopNav from "@/components/layout/TopNav";
import { DataCacheProvider, useDataCache } from "@/lib/DataCacheContext";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// ── All endpoints we want warm in cache on first load ─────────
// These fire in parallel immediately — user doesn't have to visit
// each page for data to be ready.
const PREFETCH_URLS = [
  // Dashboard (Global Overview)
  "/api/data/summary",
  "/api/data/eoi/monthly",
  "/api/data/quota",
  "/api/data/osl-trend",
  "/api/data/nero-summary",
  "/api/data/shortage-forecast?state=NSW&sort_year=2026&limit=8",

  // EOI Analysis
  "/api/data/eoi/occupations",
  "/api/data/eoi/points",

  // Shortage page
  "/api/data/shortage-forecast?limit=200&sort_year=2026",
  "/api/data/shortage-heatmap?year=2025",

  // Predictors (Volume Forecast)
  "/api/data/volume-forecast",
];

// ── Inner component that can use the cache hook ────────────────
function PrefetchOnMount() {
  const { prefetch } = useDataCache();

  useEffect(() => {
    // Fire all prefetches in parallel — results land in cache
    // Pages that load later will get instant data
    PREFETCH_URLS.forEach((url) => prefetch(url));
  }, []); // run once on mount

  return null;
}

// ── Layout ────────────────────────────────────────────────────
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DataCacheProvider>
      <PrefetchOnMount />
      <div style={{ minHeight: "100vh", background: "#080b11" }}>
        <TopNav />
        <main>{children}</main>
      </div>
    </DataCacheProvider>
  );
}
