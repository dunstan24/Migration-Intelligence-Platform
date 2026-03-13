"use client";
/**
 * Global Overview — Migration Intelligence Dashboard
 * All data real. All fetches parallel. No mock sections.
 */
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { useDataCache } from "@/lib/DataCacheContext";
import { C, Card, ChartTip } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const fmt = (n: number) => n?.toLocaleString() ?? "—";
const fmtK = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0);

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const VISA_COLORS: Record<string, string> = {
  "190": C.blue,
  "491": C.purple,
  "189": C.green,
  "188": C.amber,
};
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

function KPI({ label, value, sub, color, loading }: any) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "16px 18px",
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
      <p style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1 }}>
        {loading ? <span style={{ color: C.border }}>···</span> : value}
      </p>
      <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{sub}</p>
    </div>
  );
}

function SectionHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</p>
      {sub && (
        <p style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{sub}</p>
      )}
    </div>
  );
}

function InvBar({ rate }: { rate: number }) {
  const p = Math.min((rate ?? 0) * 100, 100);
  const col = p >= 50 ? C.green : p >= 20 ? C.blue : p >= 5 ? C.amber : C.muted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{ flex: 1, height: 3, background: C.border, borderRadius: 2 }}
      >
        <div
          style={{
            width: `${p}%`,
            height: "100%",
            background: col,
            borderRadius: 2,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 10,
          color: col,
          width: 30,
          textAlign: "right",
          fontWeight: 600,
        }}
      >
        {p > 0 ? `${p.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}

const sel: any = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "7px 12px",
  color: C.text,
  fontSize: 12,
  outline: "none",
  cursor: "pointer",
};

export default function GlobalOverview() {
  const router = useRouter();

  const { get } = useDataCache();
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [visaFilter, setVisaFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"pool" | "invitations" | "rate">(
    "invitations",
  );
  const [limit, setLimit] = useState(50);

  const [summary, setSummary] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [occs, setOccs] = useState<any[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [osl, setOsl] = useState<any>(null);
  const [nero, setNero] = useState<any>(null);
  const [forecast, setForecast] = useState<any[]>([]);

  const [loadSummary, setLoadSummary] = useState(true);
  const [loadOccs, setLoadOccs] = useState(true);

  // Fire all background requests in parallel
  useEffect(() => {
    Promise.allSettled([
      get(`/api/data/summary`),
      get(`/api/data/eoi/monthly`),
      get(`/api/data/quota`),
      get(`/api/data/osl-trend`),
      get(`/api/data/nero-summary`),
      get(`/api/data/shortage-forecast?state=NSW&sort_year=2026&limit=8`),
    ]).then(([s, m, q, osl, nero, fc]) => {
      if (s.status === "fulfilled") {
        setSummary(s.value);
        setLoadSummary(false);
      }
      if (m.status === "fulfilled") setMonthly(m.value?.records || []);
      if (q.status === "fulfilled") setQuota(q.value);
      if (osl.status === "fulfilled") setOsl(osl.value);
      if (nero.status === "fulfilled") setNero(nero.value);
      if (fc.status === "fulfilled") setForecast(fc.value?.records || []);
    });
  }, []);

  // Occupation table - refetch on filter change
  useEffect(() => {
    setLoadOccs(true);
    const p = new URLSearchParams({ limit: String(limit) });
    if (yearFilter) p.append("year", String(yearFilter));
    if (stateFilter) p.append("state", stateFilter);
    if (visaFilter) p.append("visa_type", visaFilter);
    get(`/api/data/eoi/occupations?${p}`)
      .then((d) => setOccs(d.records || []))
      .finally(() => setLoadOccs(false));
  }, [yearFilter, stateFilter, visaFilter, limit]);

  const filtered = useMemo(
    () =>
      occs
        .filter(
          (o) =>
            !search ||
            o.occupation_name.toLowerCase().includes(search.toLowerCase()) ||
            o.anzsco_code.includes(search),
        )
        .sort((a, b) =>
          sortBy === "pool"
            ? b.pool - a.pool
            : sortBy === "rate"
              ? b.invitation_rate - a.invitation_rate
              : b.invitations - a.invitations,
        ),
    [occs, search, sortBy],
  );

  const monthlyChart = monthly.slice(-14);

  const stateShortageData = STATES.map((s) => ({
    state: s,
    count: osl?.yearly_trend?.[osl.yearly_trend.length - 1]?.[s] ?? 0,
  }));

  const hasFilter = yearFilter || stateFilter || visaFilter;
  const latestOsl = osl?.yearly_trend?.[osl.yearly_trend.length - 1];

  return (
    <div
      style={{
        padding: "24px 28px",
        maxWidth: 1540,
        background: C.bg,
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 20,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 21,
              fontWeight: 800,
              color: "#f9fafb",
              marginBottom: 3,
            }}
          >
            Migration Intelligence
          </h1>
          <p style={{ fontSize: 12, color: C.muted }}>
            SkillSelect EOI · Latest snapshot:{" "}
            <strong style={{ color: C.text }}>
              {summary?.latest_snapshot ?? "…"}
            </strong>
            &nbsp;·&nbsp; {fmt(summary?.eoi_pool ?? 0)} active EOIs
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {hasFilter && (
            <button
              onClick={() => {
                setYearFilter(null);
                setStateFilter("");
                setVisaFilter("");
              }}
              style={{
                padding: "7px 12px",
                borderRadius: 6,
                border: `1px solid ${C.red}40`,
                background: `${C.red}15`,
                color: C.red,
                fontSize: 11,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ✕ Clear filters
            </button>
          )}
          <select
            style={sel}
            value={yearFilter ?? ""}
            onChange={(e) =>
              setYearFilter(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All years</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <select
            style={sel}
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">All states</option>
            {STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            style={sel}
            value={visaFilter}
            onChange={(e) => setVisaFilter(e.target.value)}
          >
            <option value="">All visas</option>
            <option value="190">Visa 190</option>
            <option value="491">Visa 491</option>
            <option value="189">Visa 189</option>
          </select>
        </div>
      </div>

      {/* KPIs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KPI
          loading={loadSummary}
          label="Active EOI Pool"
          color={C.blue}
          value={fmt(summary?.eoi_pool)}
          sub={`Snapshot ${summary?.latest_snapshot ?? "…"}`}
        />
        <KPI
          loading={loadSummary}
          label="Total Invitations"
          color={C.green}
          value={fmt(summary?.total_invitations)}
          sub="Latest snapshot"
        />
        <KPI
          loading={loadSummary}
          label="Points Cutoff"
          color={C.amber}
          value={`${summary?.points_cutoff ?? 0}pts`}
          sub="Max invited (latest)"
        />
        <KPI
          loading={loadSummary}
          label="Unique Occupations"
          color={C.purple}
          value={fmt(summary?.shortage_occupations)}
          sub="ANZSCO codes in EOI"
        />
        <KPI
          loading={!quota}
          label="Visa 190 Quota"
          color={C.cyan}
          value={quota ? fmt(quota.total_190_quota) : "…"}
          sub={`${quota?.latest_year ?? ""} allocation`}
        />
        <KPI
          loading={!osl}
          label="National Shortage"
          color="#ef4444"
          value={osl ? fmt(latestOsl?.national) : "…"}
          sub="Occupations on OSL 2025"
        />
      </div>

      {/* Row 1: EOI trend + Quota */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <Card>
          <SectionHead
            title="EOI Pool & Invitations — Last 14 Months"
            sub="Source: SkillSelect EOI snapshots · eoi_records (8.3M rows)"
          />
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart
              data={monthlyChart}
              margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient id="gPool" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="month"
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtK}
              />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area
                type="monotone"
                dataKey="pool"
                name="EOI Pool"
                stroke={C.blue}
                fill="url(#gPool)"
                strokeWidth={2}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="invitations"
                name="Invitations"
                stroke={C.green}
                fill="url(#gInv)"
                strokeWidth={2}
                dot={{ r: 2, fill: C.green }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead
            title="State Nomination Quota"
            sub={`Visa 190 + 491 · ${quota?.latest_year ?? "…"} · Source: state_nomination_quotas`}
          />
          <ResponsiveContainer width="100%" height={190}>
            <BarChart
              data={quota?.state_allocation ?? []}
              margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="state"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="visa_190"
                name="Visa 190"
                fill={C.blue}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="visa_491"
                name="Visa 491"
                fill={C.purple}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 2: OSL + State shortage + ML Forecast */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <Card>
          <SectionHead
            title="National Shortage Trend 2021–2025"
            sub="Source: osl_shortage (4,486 rows)"
          />
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart
              data={osl?.yearly_trend ?? []}
              margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
            >
              <defs>
                <linearGradient id="gOsl" x1="0" y1="0" x2="0" y2="1">
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
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} />
              <Area
                type="monotone"
                dataKey="national"
                name="National Shortage"
                stroke="#ef4444"
                fill="url(#gOsl)"
                strokeWidth={2}
                dot={{ r: 4, fill: "#ef4444" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead
            title="Shortage by State — 2025"
            sub="Source: osl_shortage · 8 states"
          />
          <ResponsiveContainer width="100%" height={170}>
            <BarChart
              data={stateShortageData}
              margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="state"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTip />} />
              <Bar
                dataKey="count"
                name="Shortage Occupations"
                radius={[3, 3, 0, 0]}
              >
                {stateShortageData.map((d) => (
                  <Cell key={d.state} fill={STATE_COLORS[d.state]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionHead
            title="Top ML Shortage Risk — NSW 2026"
            sub="Source: shortage_forecast · RandomForest (7,328 rows)"
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {forecast.length === 0 ? (
              <p
                style={{
                  color: C.muted,
                  fontSize: 11,
                  padding: "20px 0",
                  textAlign: "center",
                }}
              >
                Loading…
              </p>
            ) : (
              forecast.slice(0, 7).map((r: any) => {
                const p = r.prob_2026 ?? 0;
                const col =
                  p >= 0.65 ? "#ef4444" : p >= 0.4 ? "#f59e0b" : "#10b981";
                return (
                  <div
                    key={r.anzsco_code}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        fontFamily: "monospace",
                        width: 48,
                        flexShrink: 0,
                      }}
                    >
                      {r.anzsco_code}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        color: C.text,
                        flex: 1,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.occupation}
                    </span>
                    <div
                      style={{
                        width: 60,
                        height: 4,
                        background: C.border,
                        borderRadius: 2,
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          width: `${p * 100}%`,
                          height: "100%",
                          background: col,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: col,
                        width: 32,
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {(p * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })
            )}
            <button
              onClick={() => router.push("/dashboard/shortage")}
              style={{
                marginTop: 2,
                padding: "6px 0",
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                background: "transparent",
                color: C.muted,
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              View full forecast →
            </button>
          </div>
        </Card>
      </div>

      {/* Row 3: NERO + National planning */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <Card>
          <SectionHead
            title={`Top NERO Regional Occupations — ${nero?.latest_date ?? "…"}`}
            sub="Estimated employment in regional areas · Source: nero_regional (89k rows)"
          />
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {(nero?.top_regional ?? [])
              .slice(0, 10)
              .map((r: any, i: number) => (
                <div
                  key={r.anzsco4_code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 4px",
                    borderBottom: `1px solid ${C.border}22`,
                    background: i % 2 === 0 ? "transparent" : "#0a0e18",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: C.muted,
                      fontFamily: "monospace",
                      width: 40,
                      flexShrink: 0,
                    }}
                  >
                    {r.anzsco4_code}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: C.text,
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.anzsco4_name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.cyan,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {fmt(r.nero_estimate)}
                  </span>
                </div>
              ))}
          </div>
        </Card>

        <Card>
          <SectionHead
            title="National Migration Planning Levels"
            sub="By program type · Source: national_migration_quotas (48 rows)"
          />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={quota?.national_planning ?? []}
              margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="year"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
              />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="employer_sponsored"
                name="Employer Sponsored"
                fill={C.blue}
                stackId="a"
              />
              <Bar
                dataKey="skilled_independent"
                name="Skilled Independent"
                fill={C.green}
                stackId="a"
              />
              <Bar
                dataKey="regional"
                name="Regional"
                fill={C.purple}
                stackId="a"
              />
              <Bar
                dataKey="state_nominated"
                name="State Nominated"
                fill={C.amber}
                radius={[3, 3, 0, 0]}
                stackId="a"
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Occupation Table */}
      <Card style={{ padding: 0 }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              All Occupations
            </p>
            <p style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
              {loadOccs ? "Loading…" : `${filtered.length} occupations`}
              {yearFilter && ` · ${yearFilter}`}
              {stateFilter && ` · ${stateFilter}`}
              {visaFilter && ` · Visa ${visaFilter}`}
              &nbsp;· Click any row for full analysis
            </p>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍  Search occupation or ANZSCO…"
              style={{
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: "7px 12px",
                color: C.text,
                fontSize: 12,
                outline: "none",
                width: 260,
              }}
            />
            <select
              style={sel}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="invitations">Sort: Invitations</option>
              <option value="pool">Sort: Pool size</option>
              <option value="rate">Sort: Inv. rate</option>
            </select>
            <select
              style={sel}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={200}>Top 200</option>
            </select>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 0.7fr 0.9fr 0.9fr 0.9fr 1.1fr 1fr",
            gap: 8,
            padding: "8px 20px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          {[
            "Occupation",
            "ANZSCO",
            "Visa",
            "EOI Pool",
            "Invitations",
            "Inv. Rate",
            "Points Range",
          ].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 10,
                color: C.muted,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {loadOccs ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading occupations…
            </div>
          ) : filtered.length === 0 ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              No occupations found
            </div>
          ) : (
            filtered.map((o, i) => (
              <div
                key={`${o.anzsco_code}-${i}`}
                onClick={() =>
                  router.push(`/dashboard/occupation/${o.anzsco_code}`)
                }
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "2.2fr 0.7fr 0.9fr 0.9fr 0.9fr 1.1fr 1fr",
                  gap: 8,
                  padding: "10px 20px",
                  alignItems: "center",
                  background: i % 2 === 0 ? "transparent" : "#090d14",
                  cursor: "pointer",
                  borderBottom: `1px solid ${C.border}18`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#0f1520")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    i % 2 === 0 ? "transparent" : "#090d14")
                }
              >
                <p style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                  {o.occupation_name}
                </p>
                <span
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    fontFamily: "monospace",
                  }}
                >
                  {o.anzsco_code || "—"}
                </span>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {(o.visa_types || []).map((v: string) => (
                    <span
                      key={v}
                      style={{
                        background: `${VISA_COLORS[v] || C.muted}18`,
                        color: VISA_COLORS[v] || C.muted,
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 4,
                        border: `1px solid ${VISA_COLORS[v] || C.muted}35`,
                      }}
                    >
                      {v}
                    </span>
                  ))}
                </div>
                <span style={{ fontSize: 12, color: C.text }}>
                  {fmt(o.pool)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: o.invitations > 0 ? C.green : C.muted,
                    fontWeight: o.invitations > 0 ? 600 : 400,
                  }}
                >
                  {fmt(o.invitations)}
                </span>
                <InvBar rate={o.invitation_rate} />
                <span style={{ fontSize: 11, color: C.muted }}>
                  {o.min_invited_points > 0
                    ? `${o.min_invited_points}–${o.max_invited_points} pts`
                    : "—"}
                </span>
              </div>
            ))
          )}
        </div>

        <div
          style={{
            padding: "10px 20px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, color: C.muted }}>
            Source: SkillSelect EOI · eoi_records · 8,303,408 rows
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>
            {fmt(summary?.eoi_pool ?? 0)} active ·{" "}
            {summary?.latest_snapshot ?? "…"}
          </span>
        </div>
      </Card>
    </div>
  );
}
