"use client";
/**
 * Shortage Analysis Page — fully redesigned
 * Route: /dashboard/shortage
 * All data REAL — OSL 2021–2025 + ML forecast 2026–2030
 */
import { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";
import { useDataCache } from "@/lib/DataCacheContext";
import { C, Card, ChartTip, PageWrapper } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
const fmt = (n: number) => n?.toLocaleString() ?? "—";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const YEARS = ["2026", "2027", "2028", "2029", "2030"];
const SKILL_COLORS = ["#2a8bff", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];
const STATE_COLORS: Record<string, string> = {
  NSW: "#2a8bff",
  VIC: "#8b5cf6",
  QLD: "#f59e0b",
  SA: "#ef4444",
  WA: "#10b981",
  TAS: "#06b6d4",
  NT: "#f97316",
  ACT: "#ec4899",
};

function probColor(p: number) {
  return p >= 0.65 ? "#ef4444" : p >= 0.4 ? "#f59e0b" : "#10b981";
}

// ── Shared UI ────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 20px",
        borderTop: `3px solid ${color}`,
      }}
    >
      <p
        style={{
          fontSize: 10,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 700,
          marginBottom: 6,
        }}
      >
        {label}
      </p>
      <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
        {value}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</p>
      )}
    </div>
  );
}

function Pill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 13px",
        borderRadius: 20,
        fontSize: 11,
        cursor: "pointer",
        fontWeight: active ? 700 : 400,
        border: `1px solid ${active ? color : C.border}`,
        background: active ? `${color}20` : "transparent",
        color: active ? color : C.muted,
      }}
    >
      {label}
    </button>
  );
}

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <p
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: C.text,
          marginBottom: 2,
        }}
      >
        {title}
      </p>
      {sub && <p style={{ fontSize: 10, color: C.muted }}>{sub}</p>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB A — ML FORECAST 2026–2030
// ══════════════════════════════════════════════════════════════════

function ForecastTab() {
  const { get } = useDataCache();
  const [state, setState] = useState("NSW");
  const [sortYr, setSortYr] = useState("2026");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [data, setData] = useState<any>(null);
  const [searchData, setSearchData] = useState<any>(null); // cross-state search results
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // Fetch by state (default view)
  useEffect(() => {
    setLoading(true);
    setError("");
    get(
      `/api/data/shortage-forecast?state=${state}&limit=200&sort_year=${sortYr}`,
    )
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [state, sortYr]);

  // Cross-state search — fetches all states when user searches
  useEffect(() => {
    if (!search) {
      setSearchData(null);
      return;
    }
    setSearching(true);
    get(
      `/api/data/shortage-forecast?limit=500&sort_year=${sortYr}&search=${encodeURIComponent(search)}`,
    )
      .then((d) => {
        setSearchData(d);
        setSearching(false);
      })
      .catch(() => setSearching(false));
  }, [search, sortYr]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Which records to show
  const records: any[] = useMemo(() => {
    if (search && searchData) return searchData.records || [];
    return data?.records || [];
  }, [data, searchData, search]);

  const isSearchMode = !!(search && searchData);

  const trendData = YEARS.map((y) => ({
    year: y,
    avg: records.length
      ? +(
          records.reduce((s: number, r: any) => s + (r[`prob_${y}`] ?? 0), 0) /
          records.length
        ).toFixed(3)
      : 0,
    high: records.filter((r: any) => (r[`prob_${y}`] ?? 0) >= 0.65).length,
  }));

  const top10 = records.slice(0, 10);

  if (error)
    return (
      <Card>
        <p style={{ color: "#ef4444", fontSize: 12 }}>
          Could not load forecast. Run:{" "}
          <code style={{ fontFamily: "monospace" }}>
            python pipelines/ingestors/shortage_forecast_ingestor.py
          </code>
        </p>
      </Card>
    );

  return (
    <>
      {/* ── Controls ─────────────────────────────────────────── */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        {/* Search bar — prominent at top */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ position: "relative" as const }}>
            <span
              style={{
                position: "absolute" as const,
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                color: C.muted,
                fontSize: 14,
              }}
            >
              🔍
            </span>
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search occupation name or ANZSCO code across all states…"
              style={{
                width: "100%",
                padding: "9px 14px 9px 38px",
                borderRadius: 8,
                fontSize: 12,
                border: `1px solid ${search ? C.cyan : C.border}`,
                background: "#0d1117",
                color: C.text,
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setSearch("");
                }}
                style={{
                  position: "absolute" as const,
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: C.muted,
                  cursor: "pointer",
                  fontSize: 16,
                }}
              >
                ×
              </button>
            )}
          </div>
          {search && (
            <p style={{ fontSize: 10, color: C.cyan, marginTop: 4 }}>
              {searching
                ? "Searching all states…"
                : `Showing results for "${search}" across all states`}
            </p>
          )}
        </div>

        {/* State + year pills — dimmed during search mode */}
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            alignItems: "center",
            opacity: isSearchMode ? 0.4 : 1,
          }}
        >
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {STATES.map((s) => (
              <Pill
                key={s}
                label={s}
                active={state === s}
                color={STATE_COLORS[s]}
                onClick={() => {
                  setState(s);
                  setSearchInput("");
                }}
              />
            ))}
          </div>
          <div
            style={{
              width: 1,
              height: 18,
              background: C.border,
              margin: "0 4px",
            }}
          />
          <div style={{ display: "flex", gap: 4 }}>
            {YEARS.map((y) => (
              <Pill
                key={y}
                label={y}
                active={sortYr === y}
                color={C.cyan}
                onClick={() => setSortYr(y)}
              />
            ))}
          </div>
          {isSearchMode && (
            <span style={{ fontSize: 10, color: C.amber, marginLeft: 4 }}>
              ← State filter disabled during search
            </span>
          )}
        </div>
      </div>

      {loading && !isSearchMode ? (
        <div
          style={{
            textAlign: "center",
            padding: 60,
            color: C.muted,
            fontSize: 12,
          }}
        >
          Loading forecast data…
        </div>
      ) : (
        <>
          {/* Charts row — hide when searching a specific occupation */}
          {!isSearchMode && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <Card>
                <SectionTitle
                  title={`Top 10 Highest Risk — ${state}, ${sortYr}`}
                  sub="Probability of being on shortage list · hover for exact value"
                />
                <ResponsiveContainer width="100%" height={248}>
                  <BarChart
                    data={top10}
                    layout="vertical"
                    margin={{ left: 0, right: 52, top: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      domain={[0, 1]}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fontSize: 9, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="occupation"
                      width={180}
                      tick={{ fontSize: 8, fill: C.text }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) =>
                        v.length > 26 ? v.slice(0, 24) + "…" : v
                      }
                    />
                    <Tooltip
                      formatter={(v: any) => [
                        `${(+v * 100).toFixed(1)}%`,
                        "Shortage Probability",
                      ]}
                      contentStyle={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <ReferenceLine
                      x={0.65}
                      stroke="#ef444450"
                      strokeDasharray="4 3"
                    />
                    <ReferenceLine
                      x={0.4}
                      stroke="#f59e0b50"
                      strokeDasharray="4 3"
                    />
                    <Bar dataKey={`prob_${sortYr}`} radius={[0, 4, 4, 0]}>
                      {top10.map((r: any, i: number) => (
                        <Cell
                          key={i}
                          fill={probColor(r[`prob_${sortYr}`] ?? 0)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionTitle
                  title={`Shortage Trajectory — ${state}`}
                  sub="Average probability and high-risk count 2026–2030"
                />
                <ResponsiveContainer width="100%" height={248}>
                  <AreaChart
                    data={trendData}
                    margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                  >
                    <defs>
                      <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={C.purple}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={C.purple}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="year"
                      tick={{ fontSize: 10, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="l"
                      domain={[0, 0.6]}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fontSize: 9, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="r"
                      orientation="right"
                      tick={{ fontSize: 9, fill: C.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any, name: string) => [
                        name === "avg"
                          ? `${(+v * 100).toFixed(1)}%`
                          : String(v),
                        name === "avg" ? "Avg Probability" : "High Risk Count",
                      ]}
                      contentStyle={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <Area
                      yAxisId="l"
                      type="monotone"
                      dataKey="avg"
                      stroke={C.purple}
                      fill="url(#pGrad)"
                      strokeWidth={2}
                      dot={{ r: 4, fill: C.purple }}
                      name="avg"
                    />
                    <Bar
                      yAxisId="r"
                      dataKey="high"
                      fill={`${C.red}35`}
                      radius={[2, 2, 0, 0]}
                      name="high"
                    />
                    <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* Search result: occupation across all states as line chart */}
          {isSearchMode && records.length > 0 && (
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle
                title={`"${records[0]?.occupation}" — All States, 2026–2030`}
                sub={`ANZSCO ${records[0]?.anzsco_code} · Shortage probability per state · Source: ML model (RandomForest)`}
              />
              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  margin={{ top: 4, right: 16, bottom: 0, left: -10 }}
                  data={YEARS.map((y) => {
                    const point: any = { year: y };
                    records.forEach((r: any) => {
                      point[r.state] = r[`prob_${y}`] ?? 0;
                    });
                    return point;
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis
                    dataKey="year"
                    tick={{ fontSize: 10, fill: C.muted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fontSize: 9, fill: C.muted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any, name: string) => [
                      `${(+v * 100).toFixed(1)}%`,
                      name,
                    ]}
                    contentStyle={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                  <ReferenceLine
                    y={0.65}
                    stroke="#ef444450"
                    strokeDasharray="4 3"
                    label={{ value: "High risk", fill: "#ef4444", fontSize: 9 }}
                  />
                  <ReferenceLine
                    y={0.4}
                    stroke="#f59e0b50"
                    strokeDasharray="4 3"
                    label={{ value: "Med risk", fill: "#f59e0b", fontSize: 9 }}
                  />
                  {records.map((r: any) => (
                    <Line
                      key={r.state}
                      type="monotone"
                      dataKey={r.state}
                      stroke={STATE_COLORS[r.state] || C.muted}
                      strokeWidth={2}
                      dot={{ r: 4, fill: STATE_COLORS[r.state] || C.muted }}
                    />
                  ))}
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Full table */}
          <Card>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <SectionTitle
                title={
                  isSearchMode
                    ? `Search results for "${search}"`
                    : "All Occupations — 5-Year Forecast"
                }
                sub={
                  isSearchMode
                    ? `${records.length} result(s) across all states · sorted by ${sortYr}`
                    : `${records.length} occupations · ${state} · sorted by ${sortYr}`
                }
              />
              <div style={{ display: "flex", gap: 14 }}>
                {[
                  ["High ≥65%", "#ef4444"],
                  ["Med 40–65%", "#f59e0b"],
                  ["Low <40%", "#10b981"],
                ].map(([l, c]) => (
                  <div
                    key={l}
                    style={{ display: "flex", alignItems: "center", gap: 5 }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 2,
                        background: c,
                      }}
                    />
                    <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isSearchMode
                  ? "68px 1fr 44px 52px 52px 52px 52px 52px 60px"
                  : "68px 1fr 52px 52px 52px 52px 52px 60px",
                gap: 6,
                padding: "6px 12px",
                borderBottom: `1px solid ${C.border}`,
                marginBottom: 2,
              }}
            >
              {[
                "Code",
                "Occupation",
                ...(isSearchMode ? ["State"] : []),
                ...YEARS,
                "Trend",
              ].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.06em",
                    color: h === sortYr ? C.cyan : C.muted,
                  }}
                >
                  {h}
                  {h === sortYr ? " ▼" : ""}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div style={{ maxHeight: 460, overflowY: "auto" }}>
              {searching ? (
                <p
                  style={{
                    textAlign: "center",
                    color: C.muted,
                    padding: 24,
                    fontSize: 12,
                  }}
                >
                  Searching…
                </p>
              ) : records.length === 0 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: C.muted,
                    padding: 24,
                    fontSize: 12,
                  }}
                >
                  {search ? `No results for "${search}"` : "No data"}
                </p>
              ) : (
                records.map((r: any, i: number) => {
                  const probs = YEARS.map((y) => r[`prob_${y}`] ?? 0);
                  const sp = r[`prob_${sortYr}`] ?? 0;
                  const delta = probs[4] - probs[0];
                  const arrow = delta > 0.05 ? "↑" : delta < -0.05 ? "↓" : "→";
                  const arrowC =
                    delta > 0.05
                      ? "#ef4444"
                      : delta < -0.05
                        ? "#10b981"
                        : C.muted;
                  const cols = isSearchMode
                    ? "68px 1fr 44px 52px 52px 52px 52px 52px 60px"
                    : "68px 1fr 52px 52px 52px 52px 52px 60px";
                  return (
                    <div
                      key={`${r.anzsco_code}-${r.state}-${i}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: cols,
                        gap: 6,
                        padding: "6px 12px",
                        borderRadius: 5,
                        alignItems: "center",
                        background: i % 2 === 0 ? "transparent" : "#0a0e18",
                        borderLeft:
                          sp >= 0.65
                            ? "2px solid #ef4444"
                            : sp >= 0.4
                              ? "2px solid #f59e0b"
                              : "2px solid transparent",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          color: C.muted,
                          fontFamily: "monospace",
                        }}
                      >
                        {r.anzsco_code}
                      </span>
                      <span
                        style={{ fontSize: 11, color: C.text, lineHeight: 1.3 }}
                      >
                        {r.occupation}
                      </span>
                      {isSearchMode && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: STATE_COLORS[r.state] || C.muted,
                          }}
                        >
                          {r.state}
                        </span>
                      )}
                      {probs.map((p, yi) => {
                        const isSortCol = YEARS[yi] === sortYr;
                        return (
                          <span
                            key={yi}
                            style={{
                              fontSize: 11,
                              fontWeight: isSortCol ? 800 : 400,
                              color: probColor(p),
                              background: isSortCol
                                ? `${probColor(p)}18`
                                : "transparent",
                              borderRadius: 4,
                              padding: isSortCol ? "1px 4px" : 0,
                              textAlign: "center" as const,
                            }}
                          >
                            {pct(p)}
                          </span>
                        );
                      })}
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: arrowC,
                          textAlign: "center" as const,
                        }}
                      >
                        {arrow}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </>
      )}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// TAB B — HISTORICAL OSL 2021–2025
// ══════════════════════════════════════════════════════════════════

function HistoricalTab({ trend, heatmap, year, setYear }: any) {
  const [search, setSearch] = useState("");
  const [skillF, setSkillF] = useState<number | null>(null);

  const records = useMemo(() => {
    return (heatmap?.records || []).filter((r: any) => {
      const q = search.toLowerCase();
      return (
        (!search ||
          r.occupation_name.toLowerCase().includes(q) ||
          r.anzsco_code.includes(q)) &&
        (!skillF || r.skill_level === skillF)
      );
    });
  }, [heatmap, search, skillF]);

  const shortage = records.filter((r: any) => r.national === 1).length;
  const noList = records.filter((r: any) => r.national === 0).length;

  return (
    <>
      {/* Charts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Card>
          <SectionTitle
            title="National Shortage Count 2021–2025"
            sub="Occupations on the national shortage list"
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={trend?.yearly_trend || []}
              margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
            >
              <defs>
                <linearGradient id="rGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="year"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="national"
                name="National Shortage"
                stroke="#ef4444"
                fill="url(#rGrad)"
                strokeWidth={2}
                dot={{ r: 4, fill: "#ef4444" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle
            title={`Shortage by State — ${year}`}
            sub="Number of shortage occupations per state"
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={STATES.map((s) => ({
                state: s,
                count: heatmap?.state_shortage_counts?.[s] || 0,
              }))}
              margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="state"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="count" name="Shortage Count" radius={[4, 4, 0, 0]}>
                {STATES.map((s) => (
                  <Cell key={s} fill={STATE_COLORS[s]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle
            title="Shortage by Skill Level — 2025"
            sub="Proportion of each skill level on shortage list"
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 8,
            }}
          >
            {(trend?.skill_breakdown || []).map((s: any, i: number) => (
              <div key={s.skill_level}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: SKILL_COLORS[i],
                      }}
                    >
                      Level {s.skill_level}
                    </span>
                    <span
                      style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}
                    >
                      {s.desc}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: SKILL_COLORS[i],
                    }}
                  >
                    {s.shortage}/{s.total} · {s.pct}%
                  </span>
                </div>
                <div
                  style={{ height: 6, background: C.border, borderRadius: 3 }}
                >
                  <div
                    style={{
                      width: `${s.pct}%`,
                      height: "100%",
                      background: SKILL_COLORS[i],
                      borderRadius: 3,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle
            title="State Shortage Trend 2021–2025"
            sub="NSW · VIC · QLD · WA"
          />
          <ResponsiveContainer width="100%" height={200}>
            <LineChart
              data={trend?.yearly_trend || []}
              margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="year"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} />
              {["NSW", "VIC", "QLD", "WA"].map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={s}
                  stroke={STATE_COLORS[s]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10, color: C.muted }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {[2021, 2022, 2023, 2024, 2025].map((y) => (
            <Pill
              key={y}
              label={String(y)}
              active={y === year}
              color={C.blue}
              onClick={() => setYear(y)}
            />
          ))}
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search occupation…"
          style={{
            padding: "6px 14px",
            borderRadius: 20,
            fontSize: 11,
            outline: "none",
            width: 200,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
          }}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <Pill
            label="All"
            active={!skillF}
            color={C.purple}
            onClick={() => setSkillF(null)}
          />
          {[1, 2, 3, 4, 5].map((l) => (
            <Pill
              key={l}
              label={`L${l}`}
              active={skillF === l}
              color={SKILL_COLORS[l - 1]}
              onClick={() => setSkillF(skillF === l ? null : l)}
            />
          ))}
        </div>
        <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>
          {shortage} shortage · {noList} not on list
        </span>
      </div>

      {/* OSL Table */}
      <Card>
        <SectionTitle
          title={`Occupation Shortage List — ${year}`}
          sub={`${records.length} occupations · ● = on shortage list`}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "96px 1fr 50px 42px 42px 42px 42px 42px 42px 42px 42px 50px",
            gap: 4,
            padding: "6px 10px",
            borderBottom: `1px solid ${C.border}`,
            marginBottom: 2,
          }}
        >
          {["ANZSCO", "Occupation", "Skill", "NAT", ...STATES].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 9,
                color: C.muted,
                fontWeight: 700,
                textTransform: "uppercase" as const,
                letterSpacing: "0.06em",
              }}
            >
              {h}
            </span>
          ))}
        </div>
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          {records.length === 0 ? (
            <p
              style={{
                textAlign: "center",
                color: C.muted,
                padding: 20,
                fontSize: 12,
              }}
            >
              No results
            </p>
          ) : (
            records.map((r: any, i: number) => (
              <div
                key={r.anzsco_code}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "96px 1fr 50px 42px 42px 42px 42px 42px 42px 42px 42px 50px",
                  gap: 4,
                  padding: "6px 10px",
                  borderRadius: 5,
                  alignItems: "center",
                  background: i % 2 === 0 ? "transparent" : "#0a0e18",
                  borderLeft:
                    r.national === 1
                      ? "2px solid #ef444460"
                      : "2px solid transparent",
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    fontFamily: "monospace",
                  }}
                >
                  {r.anzsco_code}
                </span>
                <span style={{ fontSize: 11, color: C.text }}>
                  {r.occupation_name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: SKILL_COLORS[r.skill_level - 1] || C.muted,
                  }}
                >
                  L{r.skill_level}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    textAlign: "center" as const,
                    color: r.national === 1 ? "#ef4444" : "#1f2937",
                  }}
                >
                  {r.national === 1 ? "●" : "○"}
                </span>
                {STATES.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 12,
                      textAlign: "center" as const,
                      color:
                        r[s.toLowerCase()] === 1 ? STATE_COLORS[s] : "#1f2937",
                    }}
                  >
                    {r[s.toLowerCase()] === 1 ? "●" : "○"}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      </Card>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════

export default function ShortageAnalysis() {
  const { get } = useDataCache();
  const [tab, setTab] = useState<"forecast" | "historical">("forecast");
  const [trend, setTrend] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [year, setYear] = useState(2025);

  useEffect(() => {
    Promise.all([
      get(`/api/data/osl-trend`),
      get(`/api/data/shortage-heatmap?year=2025`),
    ]).then(([t, h]) => {
      setTrend(t);
      setHeatmap(h);
    });
  }, []);

  useEffect(() => {
    get(`/api/data/shortage-heatmap?year=${year}`).then((h) => setHeatmap(h));
  }, [year]);

  return (
    <PageWrapper>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#f9fafb",
            marginBottom: 4,
          }}
        >
          Occupation Shortage Analysis
        </h1>
        <p style={{ fontSize: 13, color: C.muted }}>
          Historical OSL 2021–2025 (DESE) &nbsp;·&nbsp; ML forecast 2026–2030
          (RandomForest, 916 occupations)
        </p>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label="Total Occupations"
          value={fmt(heatmap?.total_occupations)}
          sub="In OSL 2025"
          color="#2a8bff"
        />
        <KpiCard
          label="National Shortage"
          value={fmt(heatmap?.national_shortage_count)}
          sub="On shortage list"
          color="#ef4444"
        />
        <KpiCard
          label="Shortage Rate"
          value={`${heatmap?.national_shortage_pct ?? 0}%`}
          sub="Of all occupations"
          color="#f59e0b"
        />
        <KpiCard
          label="Forecast Occupations"
          value="916"
          sub="With 2026–2030 ML forecast"
          color="#8b5cf6"
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: `1px solid ${C.border}`,
          marginBottom: 20,
        }}
      >
        {(
          [
            {
              key: "forecast",
              label: "ML Forecast 2026–2030",
              color: C.purple,
            },
            {
              key: "historical",
              label: "Historical OSL 2021–2025",
              color: C.blue,
            },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 24px",
              fontSize: 12,
              fontWeight: tab === t.key ? 700 : 500,
              cursor: "pointer",
              border: "none",
              borderRadius: "8px 8px 0 0",
              background: tab === t.key ? C.surface : "transparent",
              color: tab === t.key ? t.color : C.muted,
              borderBottom:
                tab === t.key
                  ? `2px solid ${t.color}`
                  : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "forecast" && <ForecastTab />}
      {tab === "historical" && (
        <HistoricalTab
          trend={trend}
          heatmap={heatmap}
          year={year}
          setYear={setYear}
        />
      )}
    </PageWrapper>
  );
}
