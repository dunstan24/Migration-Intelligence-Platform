"use client";
/**
 * EOI Analysis page
 * Fetches real data from:
 *   GET /api/data/summary          → KPI cards
 *   GET /api/data/eoi/monthly      → pool + invitations trend
 *   GET /api/data/eoi/occupations  → top occupations table
 *   GET /api/data/eoi/points       → points distribution
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
  Cell,
} from "recharts";
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

// ── Fetchers ────────────────────────────────────────────────
async function fetchSummary() {
  const r = await fetch(`${API}/api/data/summary`);
  return r.json();
}
async function fetchMonthly() {
  const r = await fetch(`${API}/api/data/eoi/monthly`);
  return r.json();
}
async function fetchOccupations(
  year: number | null,
  state: string,
  limit: number,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (year) params.append("year", String(year));
  if (state) params.append("state", state);
  const r = await fetch(`${API}/api/data/eoi/occupations?${params}`);
  return r.json();
}
async function fetchPoints(visaType: string, state: string) {
  const params = new URLSearchParams();
  if (visaType) params.append("visa_type", visaType);
  if (state) params.append("state", state);
  const r = await fetch(`${API}/api/data/eoi/points?${params}`);
  return r.json();
}

// ── Helpers ──────────────────────────────────────────────────
function fmt(n: number) {
  return n?.toLocaleString() ?? "—";
}

const STATES = ["", "NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const VISA_TYPES = ["", "190", "491", "189", "188"];

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

// ── Main Component ───────────────────────────────────────────
export default function EOIAnalysis() {
  // Filters
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

  // Loading
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingMonthly, setLoadingMonthly] = useState(true);
  const [loadingOcc, setLoadingOcc] = useState(true);
  const [loadingPoints, setLoadingPoints] = useState(true);

  // ── Load summary once ──────────────────────────────────────
  useEffect(() => {
    setLoadingSummary(true);
    fetchSummary()
      .then((d) => setSummary(d))
      .finally(() => setLoadingSummary(false));
  }, []);

  // ── Load monthly trend once ────────────────────────────────
  useEffect(() => {
    setLoadingMonthly(true);
    fetchMonthly()
      .then((d) => setMonthly(d.records || []))
      .finally(() => setLoadingMonthly(false));
  }, []);

  // ── Reload occupations when filters change ─────────────────
  useEffect(() => {
    setLoadingOcc(true);
    fetchOccupations(yearFilter, stateFilter, occLimit)
      .then((d) => setOccupations(d.records || []))
      .finally(() => setLoadingOcc(false));
  }, [yearFilter, stateFilter, occLimit]);

  // ── Reload points when filters change ─────────────────────
  useEffect(() => {
    setLoadingPoints(true);
    fetchPoints(visaFilter, stateFilter)
      .then((d) => setPoints(d.records || []))
      .finally(() => setLoadingPoints(false));
  }, [visaFilter, stateFilter]);

  // ── Derived data ───────────────────────────────────────────
  // Points pivot: { points, SUBMITTED, INVITED }
  const pointsPivot = (() => {
    const map: Record<number, any> = {};
    for (const r of points) {
      if (!map[r.points])
        map[r.points] = { points: r.points, SUBMITTED: 0, INVITED: 0 };
      map[r.points][r.status] = r.total;
    }
    return Object.values(map).sort((a, b) => a.points - b.points);
  })();

  // Monthly — last 12 months only for readability
  const monthlyLast12 = monthly.slice(-12);

  // Filter occupations by search
  const filteredOcc = occupations.filter(
    (o) =>
      !searchOcc ||
      o.occupation_name.toLowerCase().includes(searchOcc.toLowerCase()) ||
      o.anzsco_code.includes(searchOcc),
  );

  return (
    <PageWrapper
      title="EOI Analysis"
      sub={`SkillSelect data · ${summary?.latest_snapshot || "loading..."} · ${fmt(summary?.eoi_pool)} active pool · real data from warehouse.db`}
    >
      {/* ── Filters bar ────────────────────────────────────── */}
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
          {STATES.filter(Boolean).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>

        <select
          style={selectStyle}
          value={visaFilter}
          onChange={(e) => setVisaFilter(e.target.value)}
        >
          <option value="">All Visa Types</option>
          {VISA_TYPES.filter(Boolean).map((v) => (
            <option key={v}>Visa {v}</option>
          ))}
        </select>

        {(yearFilter || stateFilter || visaFilter) && (
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
          sub="SUBMITTED status"
          color={C.blue}
        />
        <KPICard
          label="Total Invitations"
          value={loadingSummary ? "..." : fmt(summary?.total_invitations)}
          sub="INVITED status"
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

      {/* ── Monthly trend chart ─────────────────────────────── */}
      <div style={Grid.two}>
        <Card>
          <ChartHeader color={C.blue}>
            EOI Pool & Invitations — Monthly Trend
          </ChartHeader>
          {loadingMonthly ? (
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
          ) : (
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
          )}
        </Card>

        {/* ── Points distribution ─────────────────────────── */}
        <Card>
          <ChartHeader color={C.amber}>
            Points Distribution — Submitted vs Invited
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

      {/* ── Top Occupations table ───────────────────────────── */}
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
              Top Occupations by EOI Activity
            </p>
            <p style={{ fontSize: 11, color: C.muted }}>
              {loadingOcc ? "Loading..." : `${filteredOcc.length} occupations`}
              {yearFilter && ` · ${yearFilter}`}
              {stateFilter && ` · ${stateFilter}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={searchOcc}
              onChange={(e) => setSearchOcc(e.target.value)}
              placeholder="Search occupation or ANZSCO..."
              style={{ ...selectStyle, width: 240 }}
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

        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr 1fr 1fr 0.8fr",
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
                color: C.dimmed,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Table rows */}
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
            No data found — try adjusting filters
          </div>
        ) : (
          filteredOcc.map((o, i) => {
            const invRate = o.invitation_rate;
            const rateColor =
              invRate >= 0.5
                ? C.green
                : invRate >= 0.2
                  ? C.blue
                  : invRate > 0
                    ? C.amber
                    : C.muted;
            return (
              <div
                key={`${o.anzsco_code}-${i}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.8fr 0.8fr 1fr 1fr 1fr 0.8fr",
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
                  {(o.visa_types?.length > 0 ? o.visa_types : [o.visa_type])
                    .filter(Boolean)
                    .map((v: string) => (
                      <Badge
                        key={v}
                        label={`${v}`}
                        color={
                          v === "190" ? C.blue : v === "491" ? C.purple : C.cyan
                        }
                      />
                    ))}
                </div>
                <span style={{ fontSize: 12, color: C.text }}>
                  {fmt(o.pool)}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: o.invitations > 0 ? C.green : C.muted,
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
                        width: `${Math.min(invRate * 100, 100)}%`,
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
                    {invRate > 0 ? `${(invRate * 100).toFixed(0)}%` : "0%"}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: C.muted }}>
                  {o.min_invited_points > 0
                    ? `${o.min_invited_points}–${o.max_invited_points}`
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
