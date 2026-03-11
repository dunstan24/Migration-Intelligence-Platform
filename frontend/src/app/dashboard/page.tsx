"use client";
/**
 * Global Overview Dashboard
 * Fetches real EOI data from:
 *   GET /api/data/summary
 *   GET /api/data/eoi/monthly
 *   GET /api/data/eoi/occupations
 */
import { useState, useEffect, useRef } from "react";
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
} from "recharts";
import { C, Card, ChartTip, Badge } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────
type Occupation = {
  anzsco_code: string;
  occupation_name: string;
  pool: number;
  invitations: number;
  invitation_rate: number;
  max_invited_points: number;
  min_invited_points: number;
  visa_types: string[];
  states: number;
};

// ── Helpers ───────────────────────────────────────────────────
const fmt = (n: number) => n?.toLocaleString() ?? "—";
const fmtK = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const VISA_COLORS: Record<string, string> = {
  "190": C.blue,
  "491": C.purple,
  "189": C.green,
  "188": C.amber,
};

function InvBar({ rate }: { rate: number }) {
  const pct = Math.min(rate * 100, 100);
  const color =
    pct >= 50 ? C.green : pct >= 20 ? C.blue : pct >= 5 ? C.amber : C.muted;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{ flex: 1, height: 3, background: C.border, borderRadius: 2 }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color,
          width: 32,
          textAlign: "right",
          fontWeight: 600,
        }}
      >
        {pct > 0 ? `${pct.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
}

function KPI({ label, value, sub, color, icon }: any) {
  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "18px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          right: -10,
          fontSize: 52,
          opacity: 0.04,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        {icon}
      </div>
      <p
        style={{
          fontSize: 10,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
          marginBottom: 8,
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: 26,
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: 6,
        }}
      >
        {value}
      </p>
      <p style={{ fontSize: 11, color: "#374151" }}>{sub}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────
export default function GlobalOverview() {
  const router = useRouter();

  // Filters
  const [visaFilter, setVisaFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"pool" | "invitations" | "rate">(
    "invitations",
  );
  const [limit, setLimit] = useState(50);

  // Data
  const [summary, setSummary] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [occs, setOccs] = useState<Occupation[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [loadingOccs, setLoadingOccs] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // ── Fetch summary + monthly + quota once ─────────────────
  useEffect(() => {
    fetch(`${API}/api/data/summary`)
      .then((r) => r.json())
      .then(setSummary)
      .finally(() => setLoadingSummary(false));
    fetch(`${API}/api/data/eoi/monthly`)
      .then((r) => r.json())
      .then((d) => setMonthly(d.records || []));
    fetch(`${API}/api/data/quota`)
      .then((r) => r.json())
      .then(setQuota);
  }, []);

  // ── Fetch occupations on filter change ────────────────────
  useEffect(() => {
    setLoadingOccs(true);
    const p = new URLSearchParams({ limit: String(limit) });
    if (yearFilter) p.append("year", String(yearFilter));
    if (stateFilter) p.append("state", stateFilter);
    fetch(`${API}/api/data/eoi/occupations?${p}`)
      .then((r) => r.json())
      .then((d) => setOccs(d.records || []))
      .finally(() => setLoadingOccs(false));
  }, [yearFilter, stateFilter, limit]);

  // ── Client-side filter + sort ─────────────────────────────
  const filtered = occs
    .filter((o) => {
      if (visaFilter && !o.visa_types?.includes(visaFilter)) return false;
      if (
        search &&
        !o.occupation_name.toLowerCase().includes(search.toLowerCase()) &&
        !o.anzsco_code.includes(search)
      )
        return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "pool") return b.pool - a.pool;
      if (sortBy === "invitations") return b.invitations - a.invitations;
      return b.invitation_rate - a.invitation_rate;
    });

  // Monthly last 12
  const monthlyChart = monthly.slice(-12);

  const selectStyle = {
    background: C.bg,
    border: `1px solid ${C.border}`,
    borderRadius: 6,
    padding: "7px 12px",
    color: C.text,
    fontSize: 12,
    outline: "none",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        padding: "24px 28px",
        maxWidth: 1500,
        background: C.bg,
        minHeight: "100vh",
      }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
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
              fontSize: 20,
              fontWeight: 800,
              color: "#f9fafb",
              marginBottom: 3,
              letterSpacing: "-0.3px",
            }}
          >
            Migration Intelligence
          </h1>
          <p style={{ fontSize: 12, color: C.muted }}>
            SkillSelect EOI data ·{" "}
            {loadingSummary ? "..." : summary?.latest_snapshot} ·{" "}
            {fmt(summary?.eoi_pool || 0)} active pool
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
          <span style={{ fontSize: 11, color: C.muted }}>Year:</span>
          <select
            style={selectStyle}
            value={yearFilter ?? ""}
            onChange={(e) =>
              setYearFilter(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">All</option>
            <option value="2024">2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <span style={{ fontSize: 11, color: C.muted }}>State:</span>
          <select
            style={selectStyle}
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
          >
            <option value="">All States</option>
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: C.muted }}>Visa:</span>
          <select
            style={selectStyle}
            value={visaFilter}
            onChange={(e) => setVisaFilter(e.target.value)}
          >
            <option value="">All</option>
            <option value="190">190</option>
            <option value="491">491</option>
            <option value="189">189</option>
          </select>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6,1fr)",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <KPI
          label="Active EOI Pool"
          value={loadingSummary ? "..." : fmt(summary?.eoi_pool || 0)}
          sub="SUBMITTED status"
          color={C.blue}
          icon="📋"
        />
        <KPI
          label="Visa 190 Quota"
          value={quota ? fmt(quota.total_190_quota) : "..."}
          sub="State nominated 2024-25"
          color={C.purple}
          icon="🎯"
        />
        <KPI
          label="Visa 491 Quota"
          value={quota ? fmt(quota.total_491_quota) : "..."}
          sub="Regional nominated 2024-25"
          color={C.cyan}
          icon="🗺️"
        />
        <KPI
          label="Total Invitations"
          value={loadingSummary ? "..." : fmt(summary?.total_invitations || 0)}
          sub="INVITED status"
          color={C.green}
          icon="✉️"
        />
        <KPI
          label="Points Cutoff"
          value={loadingSummary ? "..." : `${summary?.points_cutoff || 0} pts`}
          sub="Max invited (latest)"
          color={C.amber}
          icon="🎯"
        />
        <KPI
          label="Occupations"
          value={
            loadingSummary ? "..." : fmt(summary?.shortage_occupations || 0)
          }
          sub="Unique ANZSCO codes"
          color={C.purple}
          icon="👷"
        />
      </div>

      {/* ── Charts Row ──────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {/* Monthly trend */}
        <Card>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#d1d5db",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.blue,
                display: "inline-block",
              }}
            />
            EOI Pool & Invitations — Monthly
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart
              data={monthlyChart}
              margin={{ top: 4, right: 8, bottom: 0, left: -15 }}
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

        {/* Visa breakdown */}
        <Card>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#d1d5db",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.purple,
                display: "inline-block",
              }}
            />
            Visa Type Breakdown
          </p>
          {(() => {
            const visaMap: Record<string, { pool: number; inv: number }> = {};
            for (const o of occs) {
              for (const v of o.visa_types || []) {
                if (!visaMap[v]) visaMap[v] = { pool: 0, inv: 0 };
                visaMap[v].pool += o.pool;
                visaMap[v].inv += o.invitations;
              }
            }
            const data = Object.entries(visaMap).map(([visa, d]) => ({
              visa: `Visa ${visa}`,
              ...d,
            }));
            return (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={data}
                  margin={{ top: 4, right: 8, bottom: 0, left: -15 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis
                    dataKey="visa"
                    tick={{ fill: C.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: C.muted, fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v / 1000000).toFixed(1) + "M"}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar
                    dataKey="pool"
                    name="Pool"
                    fill={C.blue}
                    fillOpacity={0.6}
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey="inv"
                    name="Invitations"
                    fill={C.green}
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            );
          })()}
        </Card>
      </div>

      {/* ── Quota Section ───────────────────────────────────── */}
      {quota && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
            marginBottom: 20,
          }}
        >
          {/* State allocation bar chart */}
          <Card>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#d1d5db",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.purple,
                  display: "inline-block",
                }}
              />
              State Nomination Allocation 2024–25
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={quota.state_allocation}
                margin={{ top: 4, right: 8, bottom: 0, left: -15 }}
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

          {/* National planning levels */}
          <Card>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#d1d5db",
                marginBottom: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: C.amber,
                  display: "inline-block",
                }}
              />
              National Migration Planning Levels
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart
                data={quota.national_planning}
                margin={{ top: 4, right: 8, bottom: 0, left: -15 }}
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
                  radius={[0, 0, 0, 0]}
                  stackId="a"
                />
                <Bar
                  dataKey="skilled_independent"
                  name="Skilled Independent"
                  fill={C.green}
                  radius={[0, 0, 0, 0]}
                  stackId="a"
                />
                <Bar
                  dataKey="regional"
                  name="Regional"
                  fill={C.purple}
                  radius={[0, 0, 0, 0]}
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
      )}

      {/* ── Occupation Table ─────────────────────────────────── */}
      <Card style={{ padding: 0 }}>
        {/* Table header bar */}
        <div
          style={{
            padding: "16px 20px",
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
              {loadingOccs
                ? "Loading..."
                : `${filtered.length.toLocaleString()} occupations`}
              {visaFilter && ` · Visa ${visaFilter}`}
              {stateFilter && ` · ${stateFilter}`}
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
              placeholder="🔍  Search occupation or ANZSCO..."
              style={{ ...selectStyle, width: 260 }}
            />
            <select
              style={selectStyle}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="invitations">Sort: Invitations</option>
              <option value="pool">Sort: Pool Size</option>
              <option value="rate">Sort: Inv. Rate</option>
            </select>
            <select
              style={selectStyle}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
              <option value={200}>Top 200</option>
            </select>
          </div>
        </div>

        {/* Column headers */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 0.7fr 1fr 0.9fr 0.9fr 1.1fr 1fr",
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
                color: "#374151",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 520, overflowY: "auto" }}>
          {loadingOccs ? (
            <div
              style={{
                padding: "40px 0",
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading occupations...
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
              No occupations found — try adjusting filters
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
                  gridTemplateColumns: "2.2fr 0.7fr 1fr 0.9fr 0.9fr 1.1fr 1fr",
                  gap: 8,
                  padding: "10px 20px",
                  alignItems: "center",
                  background: i % 2 === 0 ? "transparent" : "#090d14",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  borderBottom: `1px solid ${C.border}22`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "#0f1520")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background =
                    i % 2 === 0 ? "transparent" : "#090d14")
                }
              >
                {/* Occupation name */}
                <div>
                  <p style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                    {o.occupation_name}
                  </p>
                </div>

                {/* ANZSCO */}
                <span
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    fontFamily: "monospace",
                  }}
                >
                  {o.anzsco_code || "—"}
                </span>

                {/* Visa badges */}
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {(o.visa_types || []).map((v) => (
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

                {/* Pool */}
                <span style={{ fontSize: 12, color: C.text }}>
                  {fmt(o.pool)}
                </span>

                {/* Invitations */}
                <span
                  style={{
                    fontSize: 12,
                    color: o.invitations > 0 ? C.green : C.muted,
                    fontWeight: o.invitations > 0 ? 600 : 400,
                  }}
                >
                  {fmt(o.invitations)}
                </span>

                {/* Inv rate bar */}
                <InvBar rate={o.invitation_rate} />

                {/* Points range */}
                <span style={{ fontSize: 11, color: C.muted }}>
                  {o.min_invited_points > 0
                    ? `${o.min_invited_points}–${o.max_invited_points} pts`
                    : "—"}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
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
            Click any occupation to view detailed analysis
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>
            Source: SkillSelect EOI · warehouse.db ·{" "}
            {fmt(summary?.eoi_pool || 0)} active EOIs
          </span>
        </div>
      </Card>
    </div>
  );
}
