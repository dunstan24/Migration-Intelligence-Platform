"use client";
/**
 * Dashboard.jsx (Next.js: dashboard/page.tsx)
 * Fetches GET /api/data/summary — Redis cached
 * Renders KPI cards, migration trend, EOI snapshot, PR probability table
 */
import { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { C, Card, KPICard, ChartHeader, Badge, ChartTip, PageWrapper, Grid } from "@/components/ui";

// Mock — replaced by GET /api/data/summary in Sprint 1
const SUMMARY = {
  eoiPool: 25800, totalInvitations: 58570, pointsCutoff: 97, shortageOccupations: 342,
};

const migrationTrend = [
  { year: "2019", total: 254250 }, { year: "2020", total: 91300 },
  { year: "2021", total: 119950 }, { year: "2022", total: 239700 },
  { year: "2023", total: 318300 }, { year: "2024", total: 338850 },
];

const eoiMonthly = [
  { month: "May 25", invitations: 4930, pool: 21800 },
  { month: "Jun 25", invitations: 5400, pool: 23100 },
  { month: "Jul 25", invitations: 4600, pool: 20500 },
  { month: "Aug 25", invitations: 5800, pool: 24200 },
  { month: "Sep 25", invitations: 5200, pool: 23400 },
  { month: "Oct 25", invitations: 6100, pool: 25800 },
];

const occupationPR = [
  { occupation: "Registered Nurse",    anzsco: "254411", eoi: 2890, invitations: 1890, pr: 96, shortage: true  },
  { occupation: "Plumber",             anzsco: "334111", eoi: 580,  invitations: 510,  pr: 96, shortage: true  },
  { occupation: "Electrician",         anzsco: "341111", eoi: 980,  invitations: 780,  pr: 94, shortage: true  },
  { occupation: "Software Engineer",   anzsco: "261313", eoi: 3420, invitations: 1240, pr: 92, shortage: true  },
  { occupation: "Teacher (Secondary)", anzsco: "241411", eoi: 1340, invitations: 960,  pr: 91, shortage: true  },
  { occupation: "Civil Engineer",      anzsco: "233211", eoi: 1560, invitations: 820,  pr: 88, shortage: true  },
  { occupation: "Cook",                anzsco: "351411", eoi: 2200, invitations: 1400, pr: 85, shortage: true  },
  { occupation: "Accountant",          anzsco: "221111", eoi: 4100, invitations: 980,  pr: 72, shortage: false },
  { occupation: "IT Project Manager",  anzsco: "135110", eoi: 1800, invitations: 420,  pr: 65, shortage: false },
];

function PRBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? C.green : pct >= 80 ? C.blue : pct >= 70 ? C.amber : C.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, width: 34, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

export default function Dashboard() {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"pr" | "eoi" | "invitations">("pr");

  const filtered = occupationPR
    .filter(o => o.occupation.toLowerCase().includes(search.toLowerCase()) || o.anzsco.includes(search))
    .sort((a, b) => b[sortBy] - a[sortBy]);

  return (
    <PageWrapper title="Migration Intelligence Dashboard" sub="GET /api/data/summary · Redis cached · Complete_EOI_and_JSA_Data_October_2025.xlsx · occupation_state_features_2025-12.csv">

      {/* KPIs — from /api/data/summary */}
      <div style={Grid.four}>
        <KPICard label="Active EOI Pool"      value={SUMMARY.eoiPool.toLocaleString()}         sub="Oct 2025 snapshot"       color={C.blue}   />
        <KPICard label="Total Invitations"    value={SUMMARY.totalInvitations.toLocaleString()} sub="Nov 24 – Oct 25"         color={C.green}  />
        <KPICard label="Points Cutoff"        value={`${SUMMARY.pointsCutoff} pts`}             sub="Oct 2025 round"          color={C.amber}  />
        <KPICard label="Shortage Occupations" value={SUMMARY.shortageOccupations.toLocaleString()} sub="of 916 tracked"      color={C.purple} />
      </div>

      {/* Charts row */}
      <div style={Grid.two}>
        <Card>
          <ChartHeader color={C.blue}>Total Migration Grants 2019–2024</ChartHeader>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={migrationTrend} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="year" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => (v/1000).toFixed(0)+"k"} />
              <Tooltip content={<ChartTip />} />
              <Line type="monotone" dataKey="total" name="Total Grants" stroke={C.blue} strokeWidth={2.5} dot={{ fill: C.blue, r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <ChartHeader color={C.green}>EOI Pool & Invitations (Last 6 Months)</ChartHeader>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={eoiMonthly} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
              <XAxis dataKey="month" tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: C.muted, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => (v/1000).toFixed(0)+"k"} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="pool" name="EOI Pool" fill={C.blue} fillOpacity={0.4} radius={[3,3,0,0]} />
              <Bar dataKey="invitations" name="Invitations" fill={C.green} radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Occupation PR table */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#f3f4f6", marginBottom: 2 }}>Occupation PR Probability</p>
            <p style={{ fontSize: 11, color: C.muted }}>occupation_state_features_2025-12.csv · EOI invitation rates · shortage status</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search occupation..."
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 12px", color: C.text, fontSize: 12, width: 200, outline: "none" }} />
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", color: C.muted, fontSize: 12, outline: "none", cursor: "pointer" }}>
              <option value="pr">PR Probability ↓</option>
              <option value="eoi">EOI Pool ↓</option>
              <option value="invitations">Invitations ↓</option>
            </select>
          </div>
        </div>

        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 0.8fr", gap: 8, padding: "7px 14px", marginBottom: 4 }}>
          {["Occupation", "ANZSCO", "EOI Pool", "Invitations", "PR Probability", "Status"].map(h => (
            <span key={h} style={{ fontSize: 10, color: C.dimmed, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</span>
          ))}
        </div>

        {filtered.map((o, i) => (
          <div key={o.anzsco} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.4fr 0.8fr", gap: 8, padding: "10px 14px", borderRadius: 7, alignItems: "center", background: i % 2 === 0 ? "transparent" : "#0a0e16" }}>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{o.occupation}</span>
            <span style={{ fontSize: 11, color: C.muted, fontFamily: "monospace" }}>{o.anzsco}</span>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>{o.eoi.toLocaleString()}</span>
            <span style={{ fontSize: 13, color: "#9ca3af" }}>{o.invitations.toLocaleString()}</span>
            <PRBar pct={o.pr} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {o.shortage && <Badge label="Shortage" color={C.green} />}
              {o.pr >= 90 && <Badge label="High PR" color={C.blue} />}
            </div>
          </div>
        ))}
      </Card>

      {/* Sprint status */}
      <Card style={{ marginTop: 22 }}>
        <ChartHeader color={C.purple}>Sprint Roadmap</ChartHeader>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { s: "Sprint 0", label: "Foundation",      status: "done" },
            { s: "Sprint 1", label: "Data Pipeline",   status: "next" },
            { s: "Sprint 2", label: "Core Dashboard",  status: "todo" },
            { s: "Sprint 3", label: "Regional Map",    status: "todo" },
            { s: "Sprint 4", label: "ML Models",       status: "todo" },
            { s: "Sprint 5", label: "LLM + RAG",       status: "todo" },
            { s: "Sprint 6", label: "Reports + PPT",   status: "todo" },
            { s: "Sprint 7", label: "Deploy",          status: "todo" },
          ].map(({ s, label, status }) => {
            const color = status === "done" ? C.green : status === "next" ? C.blue : C.border;
            return (
              <div key={s} style={{ padding: "10px 14px", borderRadius: 8, background: C.bg, border: `1px solid ${color}` }}>
                <p style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>{s}</p>
                <p style={{ fontSize: 12, fontWeight: 600, color: status === "done" ? C.green : status === "next" ? C.blue : C.muted }}>
                  {status === "done" ? "✅ " : status === "next" ? "→ " : ""}{label}
                </p>
              </div>
            );
          })}
        </div>
      </Card>
    </PageWrapper>
  );
}
