"use client";
/**
 * Shortage Analysis Page
 * Route: /dashboard/shortage
 * Data: GET /api/data/shortage-heatmap + /api/data/osl-trend
 */
import { useState, useEffect } from "react";
import {
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
  Legend,
} from "recharts";
import { C, Card, ChartTip, PageWrapper } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
const fmt = (n: number) => n?.toLocaleString() ?? "—";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const STATE_COLORS: Record<string, string> = {
  NSW: C.blue,
  VIC: C.purple,
  QLD: C.amber,
  SA: C.red,
  WA: C.green,
  TAS: C.cyan,
  NT: "#f97316",
  ACT: "#ec4899",
};
const SKILL_COLORS = [C.blue, C.green, C.amber, C.red, C.purple];

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

export default function ShortageAnalysis() {
  const [trend, setTrend] = useState<any>(null);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [year, setYear] = useState(2025);
  const [search, setSearch] = useState("");
  const [skillFilter, setSkill] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/data/osl-trend`).then((r) => r.json()),
      fetch(`${API}/api/data/shortage-heatmap?year=${year}`).then((r) =>
        r.json(),
      ),
    ]).then(([t, h]) => {
      setTrend(t);
      setHeatmap(h);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`${API}/api/data/shortage-heatmap?year=${year}`)
      .then((r) => r.json())
      .then((h) => {
        setHeatmap(h);
        setLoading(false);
      });
  }, [year]);

  const filtered = (heatmap?.records || []).filter((r: any) => {
    const matchSearch =
      !search ||
      r.occupation_name.toLowerCase().includes(search.toLowerCase()) ||
      r.anzsco_code.includes(search);
    const matchSkill = !skillFilter || r.skill_level === skillFilter;
    return matchSearch && matchSkill;
  });

  const nationalShortage = filtered.filter((r: any) => r.national === 1);
  const noShortage = filtered.filter((r: any) => r.national === 0);

  return (
    <PageWrapper>
      {/* ── Header ────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: "#f9fafb",
            marginBottom: 4,
          }}
        >
          Occupation Shortage List
        </h1>
        <p style={{ fontSize: 13, color: C.muted }}>
          National & State shortage ratings 2021–2025 · Source: DESE OSL
        </p>
      </div>

      {/* ── KPI Row ───────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "Total Occupations",
            value: fmt(heatmap?.total_occupations),
            color: C.blue,
          },
          {
            label: "National Shortage",
            value: fmt(heatmap?.national_shortage_count),
            color: C.red,
          },
          {
            label: "Shortage Rate",
            value: `${heatmap?.national_shortage_pct ?? "—"}%`,
            color: C.amber,
          },
          { label: "Year", value: year, color: C.purple },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: "16px",
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
              {k.label}
            </p>
            <p style={{ fontSize: 24, fontWeight: 800, color: k.color }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts Row ────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 20,
        }}
      >
        {/* National shortage trend */}
        <Card>
          <SectionHeader
            title="National Shortage Trend 2021–2025"
            color={C.red}
          />
          <ResponsiveContainer width="100%" height={220}>
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
              <Line
                type="monotone"
                dataKey="national"
                name="National Shortage"
                stroke={C.red}
                strokeWidth={2}
                dot={{ r: 4, fill: C.red }}
              />
              <Line
                type="monotone"
                dataKey="total"
                name="Total Occupations"
                stroke={C.muted}
                strokeWidth={1}
                strokeDasharray="4 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* State shortage counts */}
        <Card>
          <SectionHeader title={`Shortage by State — ${year}`} color={C.blue} />
          <ResponsiveContainer width="100%" height={220}>
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
              <Bar
                dataKey="count"
                name="Shortage Occupations"
                radius={[4, 4, 0, 0]}
              >
                {STATES.map((s) => (
                  <Cell key={s} fill={STATE_COLORS[s]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Skill level breakdown */}
        <Card>
          <SectionHeader
            title="Shortage by Skill Level — 2025"
            color={C.purple}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
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
                    {s.shortage}/{s.total} ({s.pct}%)
                  </span>
                </div>
                <div
                  style={{ height: 5, background: C.border, borderRadius: 3 }}
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

        {/* State trend lines */}
        <Card>
          <SectionHeader
            title="State Shortage Trend 2021–2025"
            color={C.cyan}
          />
          <ResponsiveContainer width="100%" height={220}>
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
              <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Year selector */}
        <div style={{ display: "flex", gap: 4 }}>
          {[2021, 2022, 2023, 2024, 2025].map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${y === year ? C.blue : C.border}`,
                background: y === year ? `${C.blue}20` : "transparent",
                color: y === year ? C.blue : C.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {y}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search occupation..."
          style={{
            padding: "7px 12px",
            borderRadius: 6,
            border: `1px solid ${C.border}`,
            background: C.surface,
            color: C.text,
            fontSize: 12,
            width: 220,
            outline: "none",
          }}
        />

        {/* Skill filter */}
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={() => setSkill(null)}
            style={{
              padding: "6px 12px",
              borderRadius: 6,
              border: `1px solid ${!skillFilter ? C.purple : C.border}`,
              background: !skillFilter ? `${C.purple}20` : "transparent",
              color: !skillFilter ? C.purple : C.muted,
              fontSize: 11,
              cursor: "pointer",
            }}
          >
            All Levels
          </button>
          {[1, 2, 3, 4, 5].map((l) => (
            <button
              key={l}
              onClick={() => setSkill(skillFilter === l ? null : l)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: `1px solid ${skillFilter === l ? SKILL_COLORS[l - 1] : C.border}`,
                background:
                  skillFilter === l
                    ? `${SKILL_COLORS[l - 1]}20`
                    : "transparent",
                color: skillFilter === l ? SKILL_COLORS[l - 1] : C.muted,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              L{l}
            </button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: C.muted, marginLeft: "auto" }}>
          {nationalShortage.length} shortage · {noShortage.length} no shortage
        </span>
      </div>

      {/* ── Top 20 shortage occupations ───────────────────── */}
      <Card style={{ marginBottom: 16 }}>
        <SectionHeader
          title={`Top Shortage Occupations — ${year} (National)`}
          color={C.red}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {(trend?.top_shortages_2025 || []).slice(0, 12).map((r: any) => (
            <div
              key={r.anzsco_code}
              style={{
                padding: "10px 14px",
                background: `${C.red}08`,
                border: `1px solid ${C.red}25`,
                borderRadius: 8,
                borderLeft: `3px solid ${SKILL_COLORS[r.skill_level - 1] || C.muted}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 4,
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
                <span style={{ fontSize: 10, fontWeight: 700, color: C.red }}>
                  {r.shortage_state_count} states
                </span>
              </div>
              <p
                style={{
                  fontSize: 11,
                  color: C.text,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {r.occupation_name}
              </p>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
                Skill Level {r.skill_level}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── Full table ────────────────────────────────────── */}
      <Card>
        <SectionHeader title={`All Occupations — ${year}`} color={C.blue} />

        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "100px 1fr 60px 50px 50px 50px 50px 50px 50px 50px 50px 60px",
            gap: 6,
            padding: "6px 10px",
            marginBottom: 4,
          }}
        >
          {["ANZSCO", "Occupation", "Level", "NAT", ...STATES].map((h) => (
            <span
              key={h}
              style={{
                fontSize: 9,
                color: "#374151",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Shortage rows */}
        <div style={{ maxHeight: 500, overflowY: "auto" }}>
          {loading ? (
            <p
              style={{
                textAlign: "center",
                color: C.muted,
                padding: 20,
                fontSize: 12,
              }}
            >
              Loading...
            </p>
          ) : filtered.length === 0 ? (
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
            filtered.map((r: any, i: number) => (
              <div
                key={r.anzsco_code}
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "100px 1fr 60px 50px 50px 50px 50px 50px 50px 50px 50px 60px",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 6,
                  alignItems: "center",
                  background: i % 2 === 0 ? "transparent" : "#0a0e18",
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
                    color: SKILL_COLORS[r.skill_level - 1] || C.muted,
                    fontWeight: 700,
                  }}
                >
                  L{r.skill_level}
                </span>
                {/* National */}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: r.national === 1 ? C.red : "#1f2937",
                    textAlign: "center",
                  }}
                >
                  {r.national === 1 ? "●" : "○"}
                </span>
                {/* States */}
                {STATES.map((s) => (
                  <span
                    key={s}
                    style={{
                      fontSize: 11,
                      color:
                        r[s.toLowerCase()] === 1 ? STATE_COLORS[s] : "#1f2937",
                      textAlign: "center",
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
    </PageWrapper>
  );
}
