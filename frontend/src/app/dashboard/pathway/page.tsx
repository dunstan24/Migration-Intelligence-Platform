"use client";
/**
 * Visa Pathway Predictor
 * Route: /dashboard/pathway
 * POST /api/predict/pathway
 *
 * GBM model (model_a.joblib) — predicts best visa subclass (189/190/491)
 * given: occupation, state, points, english_level, age, experience
 */
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { C, Card } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const VISA_COLORS: Record<string, string> = {
  "189": C.green,
  "190": C.blue,
  "491": C.purple,
};
const VISA_LABELS: Record<string, string> = {
  "189": "189 — Skilled Independent",
  "190": "190 — State Nominated",
  "491": "491 — Regional (Provisional)",
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
const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
const ENGLISH = ["vocational", "competent", "proficient", "superior"];
const ENG_LABEL: Record<string, string> = {
  vocational: "Vocational (IELTS 5) +0pts",
  competent: "Competent (IELTS 6) +0pts",
  proficient: "Proficient (IELTS 7) +10pts",
  superior: "Superior (IELTS 8+) +20pts",
};

const sel: any = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "9px 12px",
  color: C.text,
  fontSize: 13,
  outline: "none",
  cursor: "pointer",
  width: "100%",
};
const inp: any = {
  background: C.bg,
  border: `1px solid ${C.border}`,
  borderRadius: 6,
  padding: "9px 12px",
  color: C.text,
  fontSize: 13,
  outline: "none",
  width: "100%",
};

function Label({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <p
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: C.muted,
          textTransform: "uppercase",
          letterSpacing: "0.07em",
        }}
      >
        {text}
      </p>
      {sub && (
        <p style={{ fontSize: 10, color: "#374151", marginTop: 1 }}>{sub}</p>
      )}
    </div>
  );
}

function ScoreBadge({ score, big }: { score: number; big?: boolean }) {
  const col =
    score >= 0.7
      ? C.green
      : score >= 0.45
        ? C.blue
        : score >= 0.25
          ? C.amber
          : "#ef4444";
  const lbl =
    score >= 0.7
      ? "High"
      : score >= 0.45
        ? "Good"
        : score >= 0.25
          ? "Moderate"
          : "Low";
  return (
    <span
      style={{
        fontSize: big ? 22 : 11,
        fontWeight: 800,
        color: col,
        background: `${col}15`,
        padding: big ? "4px 14px" : "2px 8px",
        borderRadius: big ? 8 : 4,
        border: `1px solid ${col}40`,
      }}
    >
      {(score * 100).toFixed(big ? 1 : 0)}% · {lbl}
    </span>
  );
}

export default function PathwayPredictor() {
  const [form, setForm] = useState({
    occupation: "261313",
    state: "NSW",
    points: 80,
    english_level: "proficient",
    age: 30,
    experience: 5,
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"top" | "all" | "shap">("top");

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch(`${API}/api/predict/pathway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          points: Number(form.points),
          age: Number(form.age),
          experience: Number(form.experience),
        }),
      });
      const d = await r.json();
      if (d.error) setError(d.error);
      else setResult(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived chart data ───────────────────────────────────
  const classProbs = result
    ? Object.entries(result.class_probs).map(([name, val]: any) => ({
        name: name.split("—")[0].trim(),
        prob: Math.round(val * 100),
        color: VISA_COLORS[name.split("—")[0].trim()] || C.muted,
      }))
    : [];

  const shapData = result
    ? Object.entries(result.shap_values).map(([feat, val]: any) => ({
        feature: feat,
        importance: Math.round(val * 100),
      }))
    : [];

  // Top 10 pathways for table
  const topPathways = result?.pathways?.slice(0, 12) ?? [];

  // 190 per-state for bar chart
  const state190 =
    result?.pathways
      ?.filter((p: any) => p.visa === "190")
      ?.sort((a: any, b: any) => b.score - a.score) ?? [];

  return (
    <div
      style={{
        padding: "24px 28px",
        maxWidth: 1400,
        background: C.bg,
        minHeight: "100vh",
      }}
    >
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
          Visa Pathway Predictor
        </h1>
        <p style={{ fontSize: 13, color: C.muted }}>
          GradientBoosting model (model_a) · Predicts best visa subclass (189 /
          190 / 491) from your profile
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "340px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── INPUT FORM ────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
                marginBottom: 16,
              }}
            >
              Applicant Profile
            </p>

            {/* Occupation */}
            <div style={{ marginBottom: 14 }}>
              <Label
                text="ANZSCO Occupation Code"
                sub="6-digit code e.g. 261313"
              />
              <input
                style={inp}
                value={form.occupation}
                onChange={(e) => set("occupation", e.target.value)}
                placeholder="e.g. 261313"
                maxLength={6}
              />
            </div>

            {/* State */}
            <div style={{ marginBottom: 14 }}>
              <Label
                text="Nominated State"
                sub="State you prefer or plan to apply to"
              />
              <select
                style={sel}
                value={form.state}
                onChange={(e) => set("state", e.target.value)}
              >
                {STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Points */}
            <div style={{ marginBottom: 14 }}>
              <Label
                text="Points Score"
                sub={`Current: ${form.points} pts (before English bonus)`}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={60}
                  max={140}
                  value={form.points}
                  onChange={(e) => set("points", Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.blue }}
                />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.blue,
                    minWidth: 42,
                    textAlign: "right",
                  }}
                >
                  {form.points}
                </span>
              </div>
              {/* Points threshold indicators */}
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {[
                  { pts: 60, label: "491 min", color: C.purple },
                  { pts: 65, label: "190 min", color: C.blue },
                  { pts: 80, label: "Good", color: C.green },
                  { pts: 95, label: "Strong", color: C.amber },
                ].map((t) => (
                  <div
                    key={t.pts}
                    style={{
                      flex: 1,
                      textAlign: "center",
                      padding: "3px 0",
                      borderRadius: 4,
                      fontSize: 9,
                      fontWeight: 700,
                      background:
                        form.points >= t.pts ? `${t.color}20` : `${C.border}40`,
                      color: form.points >= t.pts ? t.color : C.muted,
                      border: `1px solid ${form.points >= t.pts ? t.color + "40" : C.border}`,
                    }}
                  >
                    {t.pts}+ {t.label}
                  </div>
                ))}
              </div>
            </div>

            {/* English */}
            <div style={{ marginBottom: 14 }}>
              <Label text="English Proficiency" />
              <select
                style={sel}
                value={form.english_level}
                onChange={(e) => set("english_level", e.target.value)}
              >
                {ENGLISH.map((e) => (
                  <option key={e} value={e}>
                    {ENG_LABEL[e]}
                  </option>
                ))}
              </select>
            </div>

            {/* Age */}
            <div style={{ marginBottom: 14 }}>
              <Label text="Age" sub={`Current: ${form.age} years`} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={18}
                  max={45}
                  value={form.age}
                  onChange={(e) => set("age", Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.purple }}
                />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.purple,
                    minWidth: 34,
                    textAlign: "right",
                  }}
                >
                  {form.age}
                </span>
              </div>
            </div>

            {/* Experience */}
            <div style={{ marginBottom: 20 }}>
              <Label
                text="Years of Experience"
                sub={`In nominated occupation: ${form.experience} yrs`}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={0}
                  max={20}
                  value={form.experience}
                  onChange={(e) => set("experience", Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.cyan }}
                />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.cyan,
                    minWidth: 34,
                    textAlign: "right",
                  }}
                >
                  {form.experience}
                </span>
              </div>
            </div>

            <button
              onClick={run}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 8,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                background: loading ? C.border : C.blue,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.03em",
              }}
            >
              {loading ? "Running model…" : "⚡  Predict Pathway"}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 14px",
                  background: `${C.red}12`,
                  border: `1px solid ${C.red}40`,
                  borderRadius: 8,
                }}
              >
                <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>
              </div>
            )}
          </Card>

          {/* Model info */}
          <Card>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: C.muted,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 10,
              }}
            >
              Model Info
            </p>
            {[
              ["Algorithm", "GradientBoostingClassifier"],
              ["Estimators", "200"],
              ["Classes", "189 · 190 · 491"],
              [
                "Features",
                "6 (occupation, state, points, english, age, experience)",
              ],
              ["File", "model_a.joblib"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "5px 0",
                  borderBottom: `1px solid ${C.border}22`,
                }}
              >
                <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
                <span
                  style={{
                    fontSize: 11,
                    color: C.text,
                    textAlign: "right",
                    maxWidth: "60%",
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </Card>
        </div>

        {/* ── RESULTS ───────────────────────────────────── */}
        {!result ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 400,
              background: C.surface,
              borderRadius: 14,
              border: `1px solid ${C.border}`,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>⚡</p>
              <p style={{ fontSize: 14, color: C.muted }}>
                Fill in the profile and click Predict Pathway
              </p>
              <p style={{ fontSize: 11, color: "#374151", marginTop: 6 }}>
                Model will rank all visa × state combinations
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Top recommendation */}
            <div
              style={{
                background: `${VISA_COLORS[result.top_pathway.visa] || C.blue}10`,
                border: `1px solid ${VISA_COLORS[result.top_pathway.visa] || C.blue}40`,
                borderRadius: 14,
                padding: "20px 24px",
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
                  <p
                    style={{
                      fontSize: 11,
                      color: C.muted,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      fontWeight: 700,
                      marginBottom: 6,
                    }}
                  >
                    Top Recommended Pathway
                  </p>
                  <p
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: VISA_COLORS[result.top_pathway.visa] || C.blue,
                      marginBottom: 4,
                    }}
                  >
                    {result.top_pathway.visa_name}
                  </p>
                  {result.top_pathway.state !== "Any (National)" && (
                    <p
                      style={{
                        fontSize: 14,
                        color:
                          STATE_COLORS[result.top_pathway.state] || C.muted,
                      }}
                    >
                      → {result.top_pathway.state}
                    </p>
                  )}
                  <p
                    style={{
                      fontSize: 12,
                      color: C.muted,
                      marginTop: 6,
                      maxWidth: 440,
                    }}
                  >
                    {result.top_pathway.note}
                  </p>
                </div>
                <div style={{ textAlign: "center" }}>
                  <ScoreBadge score={result.top_pathway.score} big />
                  <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                    Model confidence
                  </p>
                </div>
              </div>

              {/* Adjusted points callout */}
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 16,
                  flexWrap: "wrap",
                }}
              >
                {[
                  {
                    label: "Base Points",
                    value: result.adjusted_points - result.english_bonus_pts,
                    color: C.blue,
                  },
                  {
                    label: "English Bonus",
                    value: `+${result.english_bonus_pts}`,
                    color: C.green,
                  },
                  {
                    label: "Adjusted Points",
                    value: result.adjusted_points,
                    color: C.amber,
                  },
                ].map((k) => (
                  <div
                    key={k.label}
                    style={{
                      padding: "8px 16px",
                      background: `${k.color}12`,
                      border: `1px solid ${k.color}30`,
                      borderRadius: 8,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 9,
                        color: C.muted,
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                      }}
                    >
                      {k.label}
                    </p>
                    <p
                      style={{ fontSize: 20, fontWeight: 800, color: k.color }}
                    >
                      {k.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                gap: 2,
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: 4,
              }}
            >
              {(
                [
                  ["top", "Top Pathways"],
                  ["all", "All States — 190"],
                  ["shap", "Feature Importance"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  style={{
                    flex: 1,
                    padding: "7px 0",
                    borderRadius: 6,
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    background: tab === id ? C.blue : "transparent",
                    color: tab === id ? "#fff" : C.muted,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab: Top Pathways */}
            {tab === "top" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                {/* Class probability bars */}
                <Card>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 14,
                    }}
                  >
                    Visa Class Probability
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart
                      data={classProbs}
                      margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: C.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tickFormatter={(v) => v + "%"}
                        tick={{ fill: C.muted, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: any) => [`${v}%`, "Probability"]}
                        contentStyle={{
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="prob" radius={[4, 4, 0, 0]}>
                        {classProbs.map((d: any) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                {/* Top 5 pathways list */}
                <Card>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 14,
                    }}
                  >
                    Ranked Pathways
                  </p>
                  {topPathways.map((p: any, i: number) => {
                    const vc = VISA_COLORS[p.visa] || C.muted;
                    const sc = STATE_COLORS[p.state] || C.muted;
                    return (
                      <div
                        key={i}
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
                            fontSize: 13,
                            fontWeight: 800,
                            color: i === 0 ? C.amber : C.muted,
                            width: 20,
                          }}
                        >
                          #{i + 1}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              alignItems: "center",
                              marginBottom: 2,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 700,
                                color: vc,
                                background: `${vc}18`,
                                padding: "1px 7px",
                                borderRadius: 4,
                                border: `1px solid ${vc}35`,
                              }}
                            >
                              {p.visa}
                            </span>
                            {p.state !== "Any (National)" && (
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: sc,
                                }}
                              >
                                {p.state}
                              </span>
                            )}
                            {!p.eligible && (
                              <span style={{ fontSize: 10, color: "#ef4444" }}>
                                Not eligible
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              height: 3,
                              background: C.border,
                              borderRadius: 2,
                            }}
                          >
                            <div
                              style={{
                                width: `${p.score * 100}%`,
                                height: "100%",
                                background: vc,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: vc,
                            width: 40,
                            textAlign: "right",
                          }}
                        >
                          {(p.score * 100).toFixed(0)}%
                        </span>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}

            {/* Tab: All States 190 */}
            {tab === "all" && (
              <Card>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: C.text,
                    marginBottom: 4,
                  }}
                >
                  Visa 190 — Score by State
                </p>
                <p style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                  Your nominated state ({form.state}) gets +3% boost · Requires
                  adj. points ≥ 65
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={state190}
                    margin={{ top: 4, right: 8, bottom: 0, left: -8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="state"
                      tick={{ fill: C.muted, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fill: C.muted, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [
                        `${(+v * 100).toFixed(1)}%`,
                        "Score",
                      ]}
                      contentStyle={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {state190.map((d: any) => (
                        <Cell
                          key={d.state}
                          fill={
                            d.state === form.state
                              ? VISA_COLORS["190"]
                              : `${VISA_COLORS["190"]}60`
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: 8,
                    marginTop: 14,
                  }}
                >
                  {state190.map((p: any) => (
                    <div
                      key={p.state}
                      style={{
                        padding: "8px 12px",
                        background:
                          p.state === form.state
                            ? `${C.blue}15`
                            : "transparent",
                        border: `1px solid ${p.state === form.state ? C.blue + "50" : C.border}`,
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: STATE_COLORS[p.state] || C.muted,
                        }}
                      >
                        {p.state}
                      </p>
                      <p
                        style={{
                          fontSize: 16,
                          fontWeight: 800,
                          color: C.blue,
                          marginTop: 2,
                        }}
                      >
                        {(p.score * 100).toFixed(1)}%
                      </p>
                      {p.state === form.state && (
                        <p
                          style={{ fontSize: 9, color: C.green, marginTop: 2 }}
                        >
                          ★ Your state
                        </p>
                      )}
                      {!p.eligible && (
                        <p style={{ fontSize: 9, color: "#ef4444" }}>
                          Not eligible
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Tab: SHAP / Feature Importance */}
            {tab === "shap" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
              >
                <Card>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 4,
                    }}
                  >
                    Feature Importance
                  </p>
                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                    GBM feature importances (proxy for SHAP) · Which input drove
                    this prediction most
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={shapData}
                      layout="vertical"
                      margin={{ top: 0, right: 40, bottom: 0, left: 20 }}
                    >
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fill: C.muted, fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="feature"
                        width={80}
                        tick={{ fill: C.muted, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: any) => [`${v}%`, "Importance"]}
                        contentStyle={{
                          background: C.surface,
                          border: `1px solid ${C.border}`,
                          borderRadius: 6,
                          fontSize: 11,
                        }}
                      />
                      <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                        {shapData.map((_: any, i: number) => (
                          <Cell
                            key={i}
                            fill={
                              [
                                C.purple,
                                C.blue,
                                C.green,
                                C.amber,
                                C.cyan,
                                "#ef4444",
                              ][i % 6]
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 14,
                    }}
                  >
                    What drove this prediction?
                  </p>
                  {shapData.map((d: any, i: number) => {
                    const colors = [
                      C.purple,
                      C.blue,
                      C.green,
                      C.amber,
                      C.cyan,
                      "#ef4444",
                    ];
                    const col = colors[i % 6];
                    const insights: Record<string, string> = {
                      occupation: `Your occupation (${form.occupation}) is the biggest driver — occupation determines eligible visa lists`,
                      english_level: `English level (${form.english_level}) adds ${form.english_level === "proficient" ? "+10" : form.english_level === "superior" ? "+20" : "+0"} pts and affects all visa eligibility`,
                      points: `Your points (${form.points}) determine base eligibility — 60+ for 491, 65+ for 190/189`,
                      age: `Age ${form.age} — points awarded: ${form.age <= 32 ? 30 : form.age <= 39 ? 25 : form.age <= 44 ? 15 : 0} pts`,
                      state: `Nominated state (${form.state}) affects 190/491 availability and nomination chances`,
                      experience: `${form.experience} years experience — ${form.experience >= 8 ? "maximum bonus" : form.experience >= 5 ? "good bonus" : "some bonus"} applied`,
                    };
                    return (
                      <div
                        key={d.feature}
                        style={{
                          marginBottom: 10,
                          padding: "10px 14px",
                          background: `${col}08`,
                          borderRadius: 8,
                          borderLeft: `3px solid ${col}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: col,
                            }}
                          >
                            {d.feature}
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                              color: col,
                            }}
                          >
                            {d.importance}%
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: C.muted }}>
                          {insights[d.feature] ||
                            `Importance: ${d.importance}%`}
                        </p>
                      </div>
                    );
                  })}
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
