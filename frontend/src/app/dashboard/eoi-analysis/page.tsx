"use client";
/**
 * EOI Analysis page
 * GET /api/data/summary          → KPI cards
 * GET /api/data/eoi/monthly      → pool + invitations trend
 * GET /api/data/eoi/occupations  → top occupations table (year, state, visa, limit)
 * GET /api/data/eoi/points       → points distribution (visa_type, state)
 */
import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useDataCache } from "@/lib/DataCacheContext";
import {
  C,
  Card,
  KPICard,
  ChartHeader,
  Badge,
  ChartTip,
  PageWrapper,
  Grid,
} from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const fmt = (n: number) => n?.toLocaleString() ?? "—";
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

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

export default function EOIAnalysis() {
  // Filters
  const { get } = useDataCache();
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [visaFilter, setVisaFilter] = useState("");
  const [occLimit, setOccLimit] = useState(20);
  const [searchOcc, setSearchOcc] = useState("");

  // Data
  const [summary, setSummary] = useState<any>(null);
  const [monthly, setMonthly] = useState<any[]>([]);
  const [occupations, setOccupations] = useState<any[]>([]);
  const [points, setPoints] = useState<any[]>([]);

  // Loading states
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingOcc, setLoadingOcc] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(true);

  // Summary + monthly — once only
  useEffect(() => {
    get(`/api/data/summary`)
      .then(setSummary)
      .finally(() => setLoadingSummary(false));
    get(`/api/data/eoi/monthly`).then((d) => setMonthly(d.records || []));
  }, []);

  // Occupations — refetch when year, state, visa, limit changes
  useEffect(() => {
    setLoadingOcc(true);
    const p = new URLSearchParams({ limit: String(occLimit) });
    if (yearFilter) p.append("year", String(yearFilter));
    if (stateFilter) p.append("state", stateFilter);
    if (visaFilter) p.append("visa_type", visaFilter);
    get(`/api/data/eoi/occupations?${p}`)
      .then((d) => setOccupations(d.records || []))
      .finally(() => setLoadingOcc(false));
  }, [yearFilter, stateFilter, visaFilter, occLimit]);

  // Points distribution — refetch when visa, state changes
  useEffect(() => {
    setLoadingPoints(true);
    const p = new URLSearchParams();
    if (visaFilter) p.append("visa_type", visaFilter);
    if (stateFilter) p.append("state", stateFilter);
    get(`/api/data/eoi/points?${p}`)
      .then((d) => setPoints(d.records || []))
      .finally(() => setLoadingPoints(false));
  }, [visaFilter, stateFilter]);

  // Pivot points → { points, SUBMITTED, INVITED }
  const pointsPivot = (() => {
    const map: Record<number, any> = {};
    for (const r of points) {
      if (!map[r.points])
        map[r.points] = { points: r.points, SUBMITTED: 0, INVITED: 0 };
      map[r.points][r.status] = r.total;
    }
    return Object.values(map).sort((a, b) => a.points - b.points);
  })();

  const monthlyLast12 = monthly.slice(-12);

  const filteredOcc = occupations.filter(
    (o) =>
      !searchOcc ||
      o.occupation_name.toLowerCase().includes(searchOcc.toLowerCase()) ||
      o.anzsco_code.includes(searchOcc),
  );

  const hasFilter = yearFilter || stateFilter || visaFilter;

  return (
    <PageWrapper
      title="EOI Analysis"
      sub={`SkillSelect data · snapshot ${summary?.latest_snapshot || "..."} · ${fmt(summary?.eoi_pool)} active pool`}
    >
      {/* ── Filter bar ─────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
          Filter:
        </span>

        <select
          style={selectStyle}
          value={yearFilter ?? ""}
          onChange={(e) =>
            setYearFilter(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All Years</option>
          <option value="2024">2024</option>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
        </select>

        <select
          style={selectStyle}
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
        >
          <option value="">All States</option>
          {STATES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          style={selectStyle}
          value={visaFilter}
          onChange={(e) => setVisaFilter(e.target.value)}
        >
          <option value="">All Visa Types</option>
          <option value="190">Visa 190</option>
          <option value="491">Visa 491</option>
          <option value="189">Visa 189</option>
          <option value="188">Visa 188</option>
        </select>

        {hasFilter && (
          <button
            onClick={() => {
              setYearFilter(null);
              setStateFilter("");
              setVisaFilter("");
            }}
            style={{
              background: `${C.red}15`,
              border: `1px solid ${C.red}40`,
              borderRadius: 6,
              padding: "7px 12px",
              color: C.red,
              fontSize: 11,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            ✕ Clear Filters
          </button>
        )}
        <span style={{ marginLeft: "auto", fontSize: 11, color: C.muted }}>
          {summary?.latest_snapshot &&
            `Latest snapshot: ${summary.latest_snapshot}`}
        </span>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div style={Grid.four}>
        <KPICard
          label="Active EOI Pool"
          value={loadingSummary ? "..." : fmt(summary?.eoi_pool)}
          sub="Submitted — latest snapshot"
          color={C.blue}
        />
        <KPICard
          label="Total Invitations"
          value={loadingSummary ? "..." : fmt(summary?.total_invitations)}
          sub="Invited — latest snapshot"
          color={C.green}
        />
        <KPICard
          label="Points Cutoff"
          value={loadingSummary ? "..." : `${summary?.points_cutoff ?? 0} pts`}
          sub="Max invited points"
          color={C.amber}
        />
        <KPICard
          label="Occupations Tracked"
          value={loadingSummary ? "..." : fmt(summary?.shortage_occupations)}
          sub="Unique ANZSCO codes"
          color={C.purple}
        />
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div style={Grid.two}>
        {/* Monthly trend */}
        <Card>
          <ChartHeader color={C.blue}>
            EOI Pool & Invitations — Last 12 Months
          </ChartHeader>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={monthlyLast12}
              margin={{ top: 4, right: 10, bottom: 0, left: -10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis
                dataKey="month"
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.muted, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
              />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="pool"
                name="EOI Pool"
                stroke={C.blue}
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="invitations"
                name="Invitations"
                stroke={C.green}
                strokeWidth={2}
                dot={{ r: 3, fill: C.green }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Points distribution */}
        <Card>
          <ChartHeader color={C.amber}>
            Points Distribution — Submitted vs Invited
            {visaFilter && (
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 8 }}>
                Visa {visaFilter}
              </span>
            )}
            {stateFilter && (
              <span style={{ fontSize: 10, color: C.muted, marginLeft: 4 }}>
                {stateFilter}
              </span>
            )}
          </ChartHeader>
          {loadingPoints ? (
            <div
              style={{
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading...
            </div>
          ) : pointsPivot.length === 0 ? (
            <div
              style={{
                height: 220,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              No data — adjust filters
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={pointsPivot}
                margin={{ top: 4, right: 10, bottom: 0, left: -10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                <XAxis
                  dataKey="points"
                  tick={{ fill: C.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: C.muted, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v / 1000).toFixed(0) + "k"}
                />
                <Tooltip content={<ChartTip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar
                  dataKey="SUBMITTED"
                  name="Submitted"
                  fill={C.blue}
                  fillOpacity={0.5}
                  radius={[2, 2, 0, 0]}
                />
                <Bar
                  dataKey="INVITED"
                  name="Invited"
                  fill={C.green}
                  radius={[2, 2, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* ── Occupations table ──────────────────────────────── */}
      <Card>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: C.text,
                marginBottom: 2,
              }}
            >
              Occupations by EOI Activity
            </p>
            <p style={{ fontSize: 11, color: C.muted }}>
              {loadingOcc ? "Loading..." : `${filteredOcc.length} occupations`}
              {yearFilter && ` · ${yearFilter}`}
              {stateFilter && ` · ${stateFilter}`}
              {visaFilter && ` · Visa ${visaFilter}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={searchOcc}
              onChange={(e) => setSearchOcc(e.target.value)}
              placeholder="Search name or ANZSCO..."
              style={{ ...selectStyle, width: 230 }}
            />
            <select
              style={selectStyle}
              value={occLimit}
              onChange={(e) => setOccLimit(Number(e.target.value))}
            >
              <option value={20}>Top 20</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr 1fr 1.2fr 0.8fr",
            gap: 8,
            padding: "7px 14px",
            marginBottom: 2,
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

        {/* Rows */}
        {loadingOcc ? (
          <div
            style={{
              padding: "30px 0",
              textAlign: "center",
              color: C.muted,
              fontSize: 12,
            }}
          >
            Loading occupations...
          </div>
        ) : filteredOcc.length === 0 ? (
          <div
            style={{
              padding: "30px 0",
              textAlign: "center",
              color: C.muted,
              fontSize: 12,
            }}
          >
            No results — try adjusting filters
          </div>
        ) : (
          filteredOcc.map((o, i) => {
            const rate = o.invitation_rate;
            const rateColor =
              rate >= 0.5
                ? C.green
                : rate >= 0.2
                  ? C.blue
                  : rate > 0
                    ? C.amber
                    : C.muted;
            return (
              <div
                key={`${o.anzsco_code}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr 1fr 1.2fr 0.8fr",
                  gap: 8,
                  padding: "9px 14px",
                  borderRadius: 6,
                  alignItems: "center",
                  background: i % 2 === 0 ? "transparent" : "#0a0e16",
                }}
              >
                <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>
                  {o.occupation_name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: C.muted,
                    fontFamily: "monospace",
                  }}
                >
                  {o.anzsco_code || "—"}
                </span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {(o.visa_types?.length > 0 ? o.visa_types : []).map(
                    (v: string) => (
                      <Badge
                        key={v}
                        label={v}
                        color={
                          v === "190" ? C.blue : v === "491" ? C.purple : C.cyan
                        }
                      />
                    ),
                  )}
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
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      flex: 1,
                      height: 4,
                      background: C.border,
                      borderRadius: 2,
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(rate * 100, 100)}%`,
                        height: "100%",
                        background: rateColor,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: rateColor,
                      width: 36,
                      textAlign: "right",
                    }}
                  >
                    {rate > 0 ? `${(rate * 100).toFixed(0)}%` : "0%"}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: C.muted }}>
                  {o.min_invited_points > 0
                    ? `${o.min_invited_points}–${o.max_invited_points} pts`
                    : "—"}
                </span>
              </div>
            );
          })
        )}
      </Card>
    </PageWrapper>
  );
}
