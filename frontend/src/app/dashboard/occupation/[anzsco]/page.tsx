"use client";
/**
 * Occupation Detail Page
 * Route: /dashboard/occupation/[anzsco]
 * Fetches: GET /api/data/occupation/{anzsco}
 */
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { C, Card, ChartTip } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const fmt = (n: number) => n?.toLocaleString() ?? "—";
const fmtK = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n ?? 0);
const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

const VISA_COLORS: Record<string, string> = {
  "190": C.blue,
  "491": C.purple,
  "189": C.green,
  "188": C.amber,
};
const STATE_ORDER = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];

const SHORTAGE_LABEL: Record<string, { label: string; color: string }> = {
  S: { label: "Shortage", color: C.red },
  NS: { label: "No Shortage", color: C.green },
  MR: { label: "Met & Rising", color: C.amber },
};
const PALETTE = [
  C.blue,
  C.purple,
  C.green,
  C.amber,
  C.cyan,
  C.red,
  "#ec4899",
  "#14b8a6",
];

// ── Sub-components ──────────────────────────────────────────────────────────

function StatBox({ label, value, sub, color }: any) {
  return (
    <div
      style={{
        background: "#0a0e18",
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: "14px 16px",
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
      <p
        style={{
          fontSize: 20,
          fontWeight: 800,
          color,
          lineHeight: 1,
          marginBottom: 4,
        }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "#374151" }}>{sub}</p>}
    </div>
  );
}

function SectionHeader({
  title,
  color = C.blue,
}: {
  title: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 14,
      }}
    >
      <div
        style={{ width: 3, height: 16, background: color, borderRadius: 2 }}
      />
      <p style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{title}</p>
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div style={{ padding: "28px 0", textAlign: "center" }}>
      <p style={{ fontSize: 12, color: "#1f2937" }}>{label}</p>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function OccupationDetail() {
  const { anzsco } = useParams<{ anzsco: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [quota, setQuota] = useState<any>(null);
  const [nero, setNero] = useState<any>(null);
  const [neroSa4, setNeroSa4] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("eoi");

  useEffect(() => {
    if (!anzsco) return;
    setLoading(true);
    const anzsco4 = anzsco.slice(0, 4);
    Promise.all([
      fetch(`${API}/api/data/occupation/${anzsco}`).then((r) => r.json()),
      fetch(`${API}/api/data/quota`).then((r) => r.json()),
      fetch(`${API}/api/data/nero/${anzsco4}`).then((r) => r.json()),
      fetch(`${API}/api/data/nero-sa4/${anzsco4}`).then((r) => r.json()),
    ])
      .then(([occ, q, n, ns]) => {
        if (occ.error) setError(occ.error);
        else setData(occ);
        const lookup: Record<string, Record<string, number>> = {};
        for (const s of q.state_allocation || []) {
          lookup[s.state] = { "190": s.visa_190, "491": s.visa_491 };
        }
        setQuota(lookup);
        setNero(n.error ? null : n);
        setNeroSa4(ns.error ? null : ns);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [anzsco]);

  if (loading)
    return (
      <div
        style={{
          padding: 40,
          textAlign: "center",
          color: C.muted,
          fontSize: 14,
        }}
      >
        Loading occupation data...
      </div>
    );
  if (error || !data)
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <p style={{ color: C.red, marginBottom: 12 }}>
          Occupation not found: {anzsco}
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            background: C.blue,
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "8px 18px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    );

  const invRate = (data.invitation_rate || 0) * 100;
  const rateColor =
    invRate >= 50
      ? C.green
      : invRate >= 20
        ? C.blue
        : invRate >= 5
          ? C.amber
          : C.red;
  const eoisub = data.eoi_summary || {};
  const openStates = (data.state_breakdown || []).filter((s: any) => s.is_open);
  const shortage = data.shortage_data?.[0];
  const shortageStyle = shortage
    ? SHORTAGE_LABEL[shortage.rating] || {
        label: shortage.rating,
        color: C.muted,
      }
    : null;
  const latestEmp = data.workforce?.[data.workforce.length - 1]?.employment;
  const proj2030 = data.employment_projection?.find(
    (p: any) => p.year === 2030,
  )?.change;
  const proj2035 = data.employment_projection?.find(
    (p: any) => p.year === 2035,
  )?.change;
  const ageData = (data.demographics || []).filter(
    (d: any) => d.category === "Age group",
  );
  const genderData = (data.demographics || []).filter(
    (d: any) =>
      d.category?.toLowerCase().includes("sex") ||
      d.category?.toLowerCase().includes("gender"),
  );

  const TABS = [
    { id: "eoi", label: "SkillSelect" },
    { id: "states", label: "Visa & State" },
    { id: "points", label: "Points" },
    { id: "workforce", label: "Workforce" },
    { id: "market", label: "Job Market" },
    { id: "demographics", label: "Demographics" },
    { id: "projection", label: "Projection" },
    { id: "nero", label: "Regional NERO" },
  ];

  return (
    <div
      style={{
        padding: "24px 28px",
        maxWidth: 1300,
        background: C.bg,
        minHeight: "100vh",
      }}
    >
      {/* Back */}
      <button
        onClick={() => router.back()}
        style={{
          background: "transparent",
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          padding: "6px 14px",
          color: C.muted,
          fontSize: 12,
          cursor: "pointer",
          marginBottom: 18,
        }}
      >
        ← Back
      </button>

      {/* ── Header ──────────────────────────────────────────── */}
      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 14,
          padding: "22px 24px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  color: C.muted,
                  background: "#0a0e18",
                  padding: "3px 8px",
                  borderRadius: 5,
                  border: `1px solid ${C.border}`,
                }}
              >
                ANZSCO {anzsco}
              </span>
              {data.visa_types?.map((v: string) => (
                <span
                  key={v}
                  style={{
                    background: `${VISA_COLORS[v] || C.muted}18`,
                    color: VISA_COLORS[v] || C.muted,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 5,
                    border: `1px solid ${VISA_COLORS[v] || C.muted}35`,
                  }}
                >
                  Visa {v}
                </span>
              ))}
              {shortageStyle && (
                <span
                  style={{
                    background: `${shortageStyle.color}18`,
                    color: shortageStyle.color,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "3px 10px",
                    borderRadius: 5,
                    border: `1px solid ${shortageStyle.color}40`,
                  }}
                >
                  ⚡ {shortageStyle.label}
                </span>
              )}
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "#f9fafb",
                letterSpacing: "-0.3px",
                marginBottom: 6,
              }}
            >
              {data.occupation_name}
            </h1>
            <p style={{ fontSize: 12, color: C.muted }}>
              {openStates.length} state{openStates.length !== 1 ? "s" : ""} open
              {latestEmp ? ` · ${fmt(latestEmp)} employed` : ""}
              {proj2030 ? ` · ${proj2030} growth to 2030` : ""}
            </p>
          </div>
          {/* Gauge */}
          <div style={{ textAlign: "center", minWidth: 90 }}>
            <div
              style={{
                position: "relative",
                width: 76,
                height: 76,
                margin: "0 auto 6px",
              }}
            >
              <svg width="76" height="76" viewBox="0 0 76 76">
                <circle
                  cx="38"
                  cy="38"
                  r="30"
                  fill="none"
                  stroke={C.border}
                  strokeWidth="6"
                />
                <circle
                  cx="38"
                  cy="38"
                  r="30"
                  fill="none"
                  stroke={rateColor}
                  strokeWidth="6"
                  strokeDasharray={`${Math.min(invRate, 100) * 1.885} 188.5`}
                  strokeDashoffset="47"
                  strokeLinecap="round"
                />
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 800, color: rateColor }}
                >
                  {invRate.toFixed(0)}%
                </span>
              </div>
            </div>
            <p
              style={{
                fontSize: 10,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}
            >
              Inv. Rate
            </p>
          </div>
        </div>
      </div>

      {/* ── KPI Row ─────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <StatBox
          label="EOI Pool"
          value={fmt(data.pool_total)}
          sub="Submitted"
          color={C.blue}
        />
        <StatBox
          label="Invitations"
          value={fmt(data.invitations_total)}
          sub="Invited"
          color={C.green}
        />
        <StatBox
          label="Open States"
          value={openStates.length}
          sub="Currently open"
          color={C.purple}
        />
        <StatBox
          label="Employed"
          value={latestEmp ? fmtK(latestEmp) : "—"}
          sub="Latest quarter"
          color={C.cyan}
        />
        <StatBox
          label="Growth 2030"
          value={proj2030 || "—"}
          sub="JSA projection"
          color={C.amber}
        />
        <StatBox
          label="Shortage"
          value={shortageStyle?.label || "—"}
          sub={shortage?.driver || "JSA"}
          color={shortageStyle?.color || C.muted}
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 16,
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 8,
          padding: 4,
          flexWrap: "wrap",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: "7px 14px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              background: activeTab === t.id ? C.blue : "transparent",
              color: activeTab === t.id ? "#fff" : C.muted,
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ SkillSelect ════════════════════════════════════════ */}
      {activeTab === "eoi" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card>
            <SectionHeader title="EOI Status Breakdown" color={C.blue} />
            {Object.entries(eoisub).map(([status, d]: any) => {
              const col =
                status === "INVITED"
                  ? C.green
                  : status === "SUBMITTED"
                    ? C.blue
                    : status === "HOLD"
                      ? C.amber
                      : C.muted;
              return (
                <div
                  key={status}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderBottom: `1px solid ${C.border}22`,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: col,
                      }}
                    />
                    <span
                      style={{ fontSize: 12, color: C.text, fontWeight: 500 }}
                    >
                      {status}
                    </span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: col }}>
                      {fmt(d.total)}
                    </p>
                    <p style={{ fontSize: 10, color: C.muted }}>
                      {d.min_pts}–{d.max_pts} pts
                    </p>
                  </div>
                </div>
              );
            })}
          </Card>

          <Card>
            <SectionHeader
              title="Invitation Probability by Points"
              color={C.green}
            />
            {[65, 70, 75, 80, 85, 90, 95, 100, 105, 110].map((pts) => {
              const s =
                data.points_distribution?.find((p: any) => p.points === pts)
                  ?.SUBMITTED || 0;
              const i =
                data.points_distribution?.find((p: any) => p.points === pts)
                  ?.INVITED || 0;
              const r = s > 0 ? Math.min((i / s) * 100, 100) : 0;
              const col =
                r >= 50
                  ? C.green
                  : r >= 20
                    ? C.blue
                    : r >= 5
                      ? C.amber
                      : C.border;
              if (s === 0 && i === 0) return null;
              return (
                <div
                  key={pts}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 7,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      width: 40,
                      textAlign: "right",
                    }}
                  >
                    {pts}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      height: 5,
                      background: C.border,
                      borderRadius: 3,
                    }}
                  >
                    <div
                      style={{
                        width: `${r}%`,
                        height: "100%",
                        background: col,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      color: col,
                      width: 34,
                      textAlign: "right",
                      fontWeight: 600,
                    }}
                  >
                    {r > 0 ? `${r.toFixed(0)}%` : "—"}
                  </span>
                  <span style={{ fontSize: 10, color: C.muted, width: 56 }}>
                    {fmt(i)} inv
                  </span>
                </div>
              );
            })}
          </Card>

          <Card style={{ gridColumn: "1 / -1" }}>
            <SectionHeader
              title="Monthly EOI Pool & Invitations (Last 12 months)"
              color={C.cyan}
            />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={(data.monthly_trend || []).slice(-12)}
                margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
              >
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.blue} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.green} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={C.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  tickFormatter={fmtK}
                />
                <Tooltip content={<ChartTip />} />
                <Area
                  type="monotone"
                  dataKey="pool"
                  name="Pool"
                  stroke={C.blue}
                  fill="url(#gP)"
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="invitations"
                  name="Invited"
                  stroke={C.green}
                  fill="url(#gI)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: C.green }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* ══ Visa & State ════════════════════════════════════════ */}
      {activeTab === "states" && (
        <Card>
          <SectionHeader title="State & Visa Availability" color={C.purple} />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {STATE_ORDER.map((state) => {
              const sd = (data.state_breakdown || []).filter(
                (s: any) => s.state === state,
              );
              const isOpen = sd.some((s: any) => s.is_open);
              return (
                <div
                  key={state}
                  style={{
                    background: isOpen ? `${C.green}10` : "#0a0e18",
                    border: `1px solid ${isOpen ? C.green + "40" : C.border}`,
                    borderRadius: 10,
                    padding: "14px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: isOpen ? C.green : C.muted,
                      }}
                    >
                      {state}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isOpen ? C.green : C.muted,
                        background: isOpen ? `${C.green}20` : `${C.muted}15`,
                        padding: "2px 7px",
                        borderRadius: 4,
                      }}
                    >
                      {isOpen ? "OPEN" : "CLOSED"}
                    </span>
                  </div>
                  {sd.map((s: any) => {
                    const stateQuota = quota?.[state]?.[s.visa_type];
                    return (
                      <div key={s.visa_type} style={{ marginBottom: 5 }}>
                        <span
                          style={{
                            fontSize: 10,
                            color: VISA_COLORS[s.visa_type] || C.muted,
                            fontWeight: 700,
                          }}
                        >
                          Visa {s.visa_type}
                        </span>
                        {s.is_open && (
                          <p style={{ fontSize: 10, color: C.amber }}>
                            {s.min_invited_points}–{s.max_invited_points} pts
                          </p>
                        )}
                        <p style={{ fontSize: 10, color: C.muted }}>
                          Pool {fmt(s.pool)} · Inv {fmt(s.invitations)}
                        </p>
                        {stateQuota ? (
                          <p style={{ fontSize: 10, color: C.cyan }}>
                            Quota: {fmt(stateQuota)} slots
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                  {sd.length === 0 && (
                    <p style={{ fontSize: 11, color: "#1f2937" }}>No data</p>
                  )}
                </div>
              );
            })}
          </div>
          {data.top_regions?.length > 0 && (
            <>
              <SectionHeader
                title="Top SA4 Regions by Employment"
                color={C.cyan}
              />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                }}
              >
                {data.top_regions.map((r: any) => (
                  <div
                    key={r.rank}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      background: "#0a0e18",
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: r.rank <= 3 ? C.amber : C.muted,
                        width: 20,
                      }}
                    >
                      #{r.rank}
                    </span>
                    <span style={{ fontSize: 12, color: C.text, flex: 1 }}>
                      {r.region}
                    </span>
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: C.blue }}
                    >
                      {fmt(r.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {/* ══ Points ══════════════════════════════════════════════ */}
      {activeTab === "points" && (
        <Card>
          <SectionHeader
            title="Points Distribution — Submitted vs Invited"
            color={C.amber}
          />
          {data.points_distribution?.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={data.points_distribution}
                margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
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
                  tickFormatter={fmtK}
                />
                <Tooltip content={<ChartTip />} />
                <Bar
                  dataKey="SUBMITTED"
                  name="Submitted"
                  fill={C.blue}
                  fillOpacity={0.5}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="INVITED"
                  name="Invited"
                  fill={C.green}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <NoData label="No points data available" />
          )}
        </Card>
      )}

      {/* ══ Workforce ════════════════════════════════════════════ */}
      {activeTab === "workforce" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card style={{ gridColumn: "1 / -1" }}>
            <SectionHeader
              title="Employment Trend (Quarterly)"
              color={C.cyan}
            />
            {data.workforce?.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={data.workforce}
                  margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                >
                  <defs>
                    <linearGradient id="gE" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.cyan} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fill: C.muted, fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: C.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={fmtK}
                  />
                  <Tooltip content={<ChartTip />} />
                  <Area
                    type="monotone"
                    dataKey="employment"
                    name="Employed"
                    stroke={C.cyan}
                    fill="url(#gE)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <NoData label="No employment data available" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Recruitment Insights" color={C.red} />
            {data.recruitment ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {[
                  {
                    label: "Vacancies Filled",
                    value: pct(data.recruitment.filled_vacancies || 0),
                    color:
                      data.recruitment.filled_vacancies > 0.7
                        ? C.green
                        : C.amber,
                  },
                  {
                    label: "Avg Applicants / Vacancy",
                    value: data.recruitment.avg_applicants?.toFixed(1),
                    color: C.blue,
                  },
                  {
                    label: "Avg Qualified Applicants",
                    value: data.recruitment.avg_qualified?.toFixed(1),
                    color: C.purple,
                  },
                  {
                    label: "Avg Suitable Applicants",
                    value: data.recruitment.avg_suitable?.toFixed(1),
                    color: C.cyan,
                  },
                  {
                    label: "Avg Experience Required",
                    value: `${data.recruitment.avg_experience?.toFixed(1)} yrs`,
                    color: C.amber,
                  },
                  {
                    label: "Require Experience",
                    value: pct(data.recruitment.pct_require_exp || 0),
                    color: C.red,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "8px 0",
                      borderBottom: `1px solid ${C.border}22`,
                    }}
                  >
                    <span style={{ fontSize: 12, color: C.muted }}>
                      {item.label}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: item.color,
                      }}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <NoData label="No recruitment data" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Main Education Fields" color={C.purple} />
            {data.education?.length > 0 ? (
              data.education.slice(0, 8).map((e: any, i: number) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{ fontSize: 11, color: C.text, maxWidth: "75%" }}
                    >
                      {e.field}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted }}>
                      {pct(e.share)}
                    </span>
                  </div>
                  <div
                    style={{ height: 4, background: C.border, borderRadius: 2 }}
                  >
                    <div
                      style={{
                        width: pct(e.share),
                        height: "100%",
                        background: PALETTE[i % PALETTE.length],
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 9, color: "#374151", marginTop: 2 }}>
                    {e.level}
                  </p>
                </div>
              ))
            ) : (
              <NoData label="No education data" />
            )}
          </Card>
        </div>
      )}

      {/* ══ Job Market ══════════════════════════════════════════ */}
      {activeTab === "market" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card style={{ gridColumn: "1 / -1" }}>
            <SectionHeader
              title="Job Advertisements (Monthly)"
              color={C.blue}
            />
            {data.job_vacancies?.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart
                  data={data.job_vacancies}
                  margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                >
                  <defs>
                    <linearGradient id="gJ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.blue} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: C.muted, fontSize: 9 }}
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
                    dataKey="job_ads"
                    name="Job Ads"
                    stroke={C.blue}
                    fill="url(#gJ)"
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <NoData label="No job ads data available" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Shortage Status" color={C.red} />
            {data.shortage_data?.length > 0 ? (
              data.shortage_data.map((s: any) => {
                const ss = SHORTAGE_LABEL[s.rating] || {
                  label: s.rating,
                  color: C.muted,
                };
                return (
                  <div
                    key={s.anzsco_code}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      padding: "10px 0",
                      borderBottom: `1px solid ${C.border}22`,
                    }}
                  >
                    <div>
                      <p style={{ fontSize: 12, color: C.text }}>{s.name}</p>
                      <p style={{ fontSize: 10, color: C.muted }}>
                        {s.anzsco_code} · {s.driver || "—"}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: ss.color,
                        background: `${ss.color}18`,
                        padding: "3px 10px",
                        borderRadius: 5,
                        border: `1px solid ${ss.color}35`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ss.label}
                    </span>
                  </div>
                );
              })
            ) : (
              <NoData label="No shortage data" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Top Hiring Regions" color={C.green} />
            {data.top_regions?.length > 0 ? (
              data.top_regions.map((r: any) => (
                <div
                  key={r.rank}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 0",
                    borderBottom: `1px solid ${C.border}22`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: r.rank <= 3 ? C.amber : C.muted,
                      width: 24,
                    }}
                  >
                    #{r.rank}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        height: 4,
                        background: C.border,
                        borderRadius: 2,
                        marginBottom: 3,
                      }}
                    >
                      <div
                        style={{
                          width: `${(r.value / (data.top_regions[0]?.value || 1)) * 100}%`,
                          height: "100%",
                          background: C.green,
                          borderRadius: 2,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, color: C.text }}>
                      {r.region}
                    </span>
                  </div>
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: C.green }}
                  >
                    {fmt(r.value)}
                  </span>
                </div>
              ))
            ) : (
              <NoData label="No regional data" />
            )}
          </Card>
        </div>
      )}

      {/* ══ Demographics ════════════════════════════════════════ */}
      {activeTab === "demographics" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card>
            <SectionHeader title="Age Group Distribution" color={C.purple} />
            {ageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={ageData}
                  layout="vertical"
                  margin={{ top: 0, right: 50, bottom: 0, left: 10 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 0.5]}
                    tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    tick={{ fill: C.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="segment"
                    tick={{ fill: C.muted, fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip
                    content={<ChartTip />}
                    formatter={(v: any) => `${(v * 100).toFixed(1)}%`}
                  />
                  <Bar dataKey="share" name="Share" radius={[0, 4, 4, 0]}>
                    {ageData.map((_: any, i: number) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <NoData label="No age data" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Gender Distribution" color={C.cyan} />
            {genderData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="share"
                    nameKey="segment"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, value }: any) =>
                      `${name} ${(value * 100).toFixed(0)}%`
                    }
                  >
                    {genderData.map((_: any, i: number) => (
                      <Cell key={i} fill={PALETTE[i]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${(v * 100).toFixed(1)}%`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div>
                {(data.demographics || [])
                  .slice(0, 15)
                  .map((d: any, i: number) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: `1px solid ${C.border}22`,
                      }}
                    >
                      <span style={{ fontSize: 11, color: C.muted }}>
                        {d.category} · {d.segment}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: PALETTE[i % PALETTE.length],
                        }}
                      >
                        {pct(d.share)}
                      </span>
                    </div>
                  ))}
                {!data.demographics?.length && (
                  <NoData label="No demographics data" />
                )}
              </div>
            )}
          </Card>

          <Card style={{ gridColumn: "1 / -1" }}>
            <SectionHeader title="Education Fields & Levels" color={C.amber} />
            {data.education?.length > 0 ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                }}
              >
                {data.education.map((e: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      padding: "10px 14px",
                      background: "#0a0e18",
                      borderRadius: 8,
                      borderLeft: `3px solid ${PALETTE[i % PALETTE.length]}`,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 12,
                        color: C.text,
                        fontWeight: 600,
                        marginBottom: 3,
                      }}
                    >
                      {e.field}
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ fontSize: 10, color: C.muted }}>
                        {e.level}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: PALETTE[i % PALETTE.length],
                        }}
                      >
                        {pct(e.share)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <NoData label="No education data" />
            )}
          </Card>
        </div>
      )}

      {/* ══ Projection ══════════════════════════════════════════ */}
      {activeTab === "projection" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <Card>
            <SectionHeader
              title="Employment Growth Projection"
              color={C.green}
            />
            {data.employment_projection?.length > 0 ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  marginTop: 8,
                }}
              >
                {data.employment_projection.map((p: any) => {
                  const val = parseFloat(p.change?.replace("%", "") || "0");
                  const col =
                    val >= 15
                      ? C.green
                      : val >= 5
                        ? C.blue
                        : val < 0
                          ? C.red
                          : C.amber;
                  return (
                    <div
                      key={p.year}
                      style={{
                        background: "#0a0e18",
                        border: `1px solid ${C.border}`,
                        borderRadius: 12,
                        padding: "20px 24px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 11,
                          color: C.muted,
                          marginBottom: 4,
                        }}
                      >
                        By {p.year}
                      </p>
                      <p
                        style={{
                          fontSize: 40,
                          fontWeight: 900,
                          color: col,
                          lineHeight: 1,
                        }}
                      >
                        {p.change}
                      </p>
                      <p style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                        Projected change · {p.group}
                      </p>
                      <div
                        style={{
                          marginTop: 10,
                          height: 6,
                          background: C.border,
                          borderRadius: 3,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(Math.abs(val) * 2, 100)}%`,
                            height: "100%",
                            background: col,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <NoData label="No projection data" />
            )}
          </Card>

          <Card>
            <SectionHeader title="Shortage Assessment" color={C.red} />
            {data.shortage_data?.length > 0 ? (
              data.shortage_data.map((s: any) => {
                const ss = SHORTAGE_LABEL[s.rating] || {
                  label: s.rating,
                  color: C.muted,
                };
                return (
                  <div
                    key={s.anzsco_code}
                    style={{
                      background: "#0a0e18",
                      border: `1px solid ${ss.color}30`,
                      borderRadius: 10,
                      padding: "16px",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: 12,
                            color: C.text,
                            fontWeight: 600,
                          }}
                        >
                          {s.name}
                        </p>
                        <p style={{ fontSize: 10, color: C.muted }}>
                          ANZSCO {s.anzsco_code}
                        </p>
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: ss.color,
                        }}
                      >
                        {ss.label}
                      </span>
                    </div>
                    {s.driver && (
                      <div
                        style={{
                          background: `${ss.color}10`,
                          borderRadius: 6,
                          padding: "6px 10px",
                        }}
                      >
                        <p style={{ fontSize: 11, color: ss.color }}>
                          Driver: {s.driver}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <NoData label="No shortage data" />
            )}

            {(proj2030 || proj2035) && (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  background: `${C.green}10`,
                  border: `1px solid ${C.green}30`,
                  borderRadius: 10,
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    color: C.green,
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  Growth Outlook
                </p>
                {proj2030 && (
                  <p style={{ fontSize: 11, color: C.muted }}>
                    2030 —{" "}
                    <strong style={{ color: C.green }}>{proj2030}</strong>{" "}
                    projected growth
                  </p>
                )}
                {proj2035 && (
                  <p style={{ fontSize: 11, color: C.muted }}>
                    2035 —{" "}
                    <strong style={{ color: C.green }}>{proj2035}</strong>{" "}
                    projected growth
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── 8: Regional NERO ── */}
      {activeTab === "nero" && (
        <div>
          {!nero ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <p style={{ fontSize: 12, color: C.muted }}>
                No NERO data for ANZSCO4 {anzsco?.slice(0, 4)}
              </p>
              <p style={{ fontSize: 11, color: "#374151", marginTop: 6 }}>
                Run nero_ingestor.py to load regional job demand data
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <Card style={{ gridColumn: "1 / -1" }}>
                <SectionHeader
                  title="NERO — Regional vs Major City (Last 3 Years)"
                  color={C.blue}
                />
                <div
                  style={{
                    display: "flex",
                    gap: 16,
                    marginBottom: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    {
                      label: "Regional (latest)",
                      value: nero.latest_regional?.["Regional"],
                      yoy: nero.yoy_regional,
                      color: C.green,
                    },
                    {
                      label: "Major City (latest)",
                      value: nero.latest_regional?.["Major City"],
                      yoy: nero.yoy_major_city,
                      color: C.blue,
                    },
                    {
                      label: "Northern AU (latest)",
                      value: nero.latest_northern?.nero_estimate,
                      yoy: null,
                      color: C.amber,
                    },
                  ].map((k) => (
                    <div
                      key={k.label}
                      style={{
                        padding: "10px 16px",
                        background: `${k.color}10`,
                        border: `1px solid ${k.color}30`,
                        borderRadius: 8,
                        minWidth: 150,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          color: C.muted,
                          marginBottom: 4,
                        }}
                      >
                        {k.label}
                      </p>
                      <p
                        style={{
                          fontSize: 20,
                          fontWeight: 800,
                          color: k.color,
                        }}
                      >
                        {k.value ? fmt(k.value) : "—"}
                      </p>
                      {k.yoy != null && (
                        <p
                          style={{
                            fontSize: 10,
                            color: k.yoy >= 0 ? C.green : C.red,
                            marginTop: 3,
                          }}
                        >
                          {k.yoy >= 0 ? "▲" : "▼"} {Math.abs(k.yoy)}% YoY
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart
                    data={nero.regional_trend || []}
                    margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: C.muted, fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v?.slice(0, 7)}
                      interval={5}
                    />
                    <YAxis
                      tick={{ fill: C.muted, fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip content={<ChartTip />} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line
                      type="monotone"
                      dataKey="Regional"
                      name="Regional"
                      stroke={C.green}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="Major City"
                      name="Major City"
                      stroke={C.blue}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionHeader
                  title="Northern Australia NERO Trend"
                  color={C.amber}
                />
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart
                    data={nero.northern_trend || []}
                    margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                  >
                    <defs>
                      <linearGradient id="gNorth" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={C.amber}
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={C.amber}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: C.muted, fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: string) => v?.slice(0, 7)}
                      interval={5}
                    />
                    <YAxis
                      tick={{ fill: C.muted, fontSize: 9 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) =>
                        v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                      }
                    />
                    <Tooltip content={<ChartTip />} />
                    <Area
                      type="monotone"
                      dataKey="nero_estimate"
                      name="Northern AU NERO"
                      stroke={C.amber}
                      fill="url(#gNorth)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <SectionHeader
                  title="Employment by State (SA4 Level)"
                  color={C.purple}
                />
                {neroSa4?.by_state?.length > 0 ? (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    <p
                      style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}
                    >
                      Latest: {neroSa4.latest_date} · Total:{" "}
                      {fmt(neroSa4.total_employment)}
                    </p>
                    {neroSa4.by_state.map((s: any) => {
                      const sp =
                        neroSa4.total_employment > 0
                          ? (s.nsc_emp / neroSa4.total_employment) * 100
                          : 0;
                      const sc: Record<string, string> = {
                        NSW: C.blue,
                        VIC: C.purple,
                        QLD: C.amber,
                        WA: C.green,
                        SA: C.red,
                        TAS: C.cyan,
                        NT: "#f97316",
                        ACT: "#ec4899",
                      };
                      const col = sc[s.state] || C.muted;
                      return (
                        <div key={s.state}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 3,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                color: col,
                                fontWeight: 700,
                              }}
                            >
                              {s.state}
                            </span>
                            <span style={{ fontSize: 11, color: C.text }}>
                              {fmt(s.nsc_emp)}{" "}
                              <span style={{ color: C.muted }}>
                                ({sp.toFixed(1)}%)
                              </span>
                            </span>
                          </div>
                          <div
                            style={{
                              height: 4,
                              background: C.border,
                              borderRadius: 2,
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                width: `${sp}%`,
                                height: "100%",
                                background: col,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: C.muted }}>
                    Run nero_sa4_ingestor.py to enable state breakdown.
                  </p>
                )}
              </Card>

              {neroSa4?.by_sa4?.length > 0 && (
                <Card style={{ gridColumn: "1 / -1" }}>
                  <SectionHeader
                    title={`Top SA4 Regions — ${neroSa4.latest_date}`}
                    color={C.cyan}
                  />
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8,
                    }}
                  >
                    {neroSa4.by_sa4.slice(0, 12).map((r: any, i: number) => {
                      const sc: Record<string, string> = {
                        NSW: C.blue,
                        VIC: C.purple,
                        QLD: C.amber,
                        WA: C.green,
                        SA: C.red,
                        TAS: C.cyan,
                        NT: "#f97316",
                        ACT: "#ec4899",
                      };
                      const col = sc[r.state] || C.muted;
                      const rp =
                        neroSa4.total_employment > 0
                          ? (r.nsc_emp / neroSa4.total_employment) * 100
                          : 0;
                      return (
                        <div
                          key={r.sa4_code}
                          style={{
                            padding: "10px 12px",
                            background: `${col}08`,
                            border: `1px solid ${col}25`,
                            borderRadius: 8,
                            borderLeft: `3px solid ${col}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: 2,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                color: col,
                                fontWeight: 700,
                              }}
                            >
                              {r.state}
                            </span>
                            <span style={{ fontSize: 10, color: C.muted }}>
                              #{i + 1}
                            </span>
                          </div>
                          <p
                            style={{
                              fontSize: 11,
                              color: C.text,
                              fontWeight: 600,
                              marginBottom: 2,
                            }}
                          >
                            {r.sa4_name}
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: col,
                              fontWeight: 800,
                            }}
                          >
                            {fmt(r.nsc_emp)}
                          </p>
                          <p style={{ fontSize: 10, color: C.muted }}>
                            {rp.toFixed(1)}% of national
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
