"use client";
/**
 * Predictors.jsx (Next.js: dashboard/predictors/page.tsx)
 * POST /api/predict/{model_name} → { prediction, confidence, shap_values }
 * model_name: "pathway" | "shortage" | "volume" | "approval"
 */
import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { C, Card, ChartHeader, Badge, PageWrapper, Grid } from "@/components/ui";
import { predictAPI } from "@/api/client";

const MODELS = [
  { id: "pathway",  label: "A — Pathway Predictor",  desc: "GradientBoostingClassifier — ranked visa + state recommendations" },
  { id: "shortage", label: "B — Shortage Forecaster", desc: "RandomForestClassifier — shortage probability 2026–2030" },
  { id: "volume",   label: "C — Volume Forecaster",   desc: "Prophet — monthly visa grant forecast to Dec 2030" },
  { id: "approval", label: "D — Approval Scorer",     desc: "LogisticRegression — approval probability + risk flags" },
];

// Mock response shapes matching README spec
function mockPredict(model: string, form: any) {
  if (model === "pathway") return {
    prediction: 0.87, confidence: 0.92,
    shap_values: { occupation: 0.42, state: 0.18, points: 0.15, english: 0.12, age: 0.08, experience: 0.05 },
    pathways: [
      { visa: "190 — State Nominated", state: "VIC", score: 0.91 },
      { visa: "491 — Regional",        state: "QLD", score: 0.84 },
      { visa: "189 — Independent",     state: "NSW", score: 0.71 },
    ],
  };
  if (model === "shortage") return {
    prediction: 0.82, confidence: 0.88,
    shap_values: { shortage_streak: 0.38, employment_growth: 0.24, jsa_rating: 0.18, eoi_activity: 0.12, shortage_count_5yr: 0.08 },
    forecast: [
      { year: 2026, probability: 0.78 }, { year: 2027, probability: 0.82 },
      { year: 2028, probability: 0.85 }, { year: 2029, probability: 0.87 }, { year: 2030, probability: 0.89 },
    ],
  };
  if (model === "approval") return {
    prediction: 0.79, confidence: 0.84,
    shap_values: { points_score: 0.35, english_band: 0.22, skills_assessed: 0.18, country_risk: 0.14, experience: 0.11 },
    risk_flags: ["Country risk tier 2", "Skills assessment pending verification"],
    recommendation: "LIKELY APPROVED — address risk flags before lodging",
  };
  return { prediction: 0.74, confidence: 0.81, shap_values: { base: 0.5, trend: 0.3, seasonal: 0.2 } };
}

function SHAPChart({ shapValues }: { shapValues: Record<string, number> }) {
  const data = Object.entries(shapValues)
    .map(([feature, value]) => ({ feature: feature.replace(/_/g, " "), value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
        <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="feature" tick={{ fill: C.text, fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
        <Tooltip formatter={(v: any) => [v, "SHAP value"]} contentStyle={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 }} />
        <Bar dataKey="value" name="SHAP" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => <Cell key={i} fill={C.blue} fillOpacity={0.4 + (i * 0.1)} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function GaugeMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? C.green : pct >= 60 ? C.amber : C.red;
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto 12px" }}>
        <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="60" cy="60" r="50" fill="none" stroke={C.border} strokeWidth="12" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={color} strokeWidth="12"
            strokeDasharray={`${pct * 3.14} 314`} strokeLinecap="round" />
        </svg>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1 }}>{pct}%</p>
        </div>
      </div>
      <p style={{ fontSize: 12, color: C.muted }}>Probability Score</p>
    </div>
  );
}

export default function Predictors() {
  const [activeModel, setActiveModel] = useState("pathway");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    occupation: "261313", state: "VIC", points: "85", english: "superior",
    age: "32", experience: "5", country: "India", visa_type: "189",
  });

  const set = (k: string) => (e: any) => setForm(f => ({ ...f, [k]: e.target.value }));

  async function runPredict() {
    setLoading(true);
    // POST /api/predict/{model_name} — mock until Sprint 4
    await new Promise(r => setTimeout(r, 900));
    setResult(mockPredict(activeModel, form));
    setLoading(false);
  }

  const inputStyle = {
    background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6,
    padding: "8px 12px", color: C.text, fontSize: 12, width: "100%", outline: "none",
  };
  const labelStyle = { fontSize: 11, color: C.muted, marginBottom: 4, display: "block", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" };

  return (
    <PageWrapper title="ML Predictors" sub="POST /api/predict/{model_name} → { prediction, confidence, shap_values } · 4 models loaded at startup">

      {/* Model selector */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        {MODELS.map(m => (
          <button key={m.id} onClick={() => { setActiveModel(m.id); setResult(null); }} style={{
            background: activeModel === m.id ? `${C.blue}18` : C.surface,
            border: `1px solid ${activeModel === m.id ? C.blue : C.border}`,
            borderRadius: 10, padding: 16, cursor: "pointer", textAlign: "left",
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: activeModel === m.id ? C.blue : C.text, marginBottom: 4 }}>{m.label}</p>
            <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.4 }}>{m.desc}</p>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 16 }}>
        {/* Input form */}
        <Card>
          <ChartHeader color={C.blue}>Input Features — model: {activeModel}</ChartHeader>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>ANZSCO Code</label>
              <input style={inputStyle} value={form.occupation} onChange={set("occupation")} placeholder="e.g. 261313" />
            </div>
            <div>
              <label style={labelStyle}>State</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.state} onChange={set("state")}>
                {["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Points Score</label>
              <input style={inputStyle} value={form.points} onChange={set("points")} type="number" />
            </div>
            <div>
              <label style={labelStyle}>English Level</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.english} onChange={set("english")}>
                {["competent","proficient","superior"].map(e => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Age</label>
              <input style={inputStyle} value={form.age} onChange={set("age")} type="number" />
            </div>
            <div>
              <label style={labelStyle}>Experience (yrs)</label>
              <input style={inputStyle} value={form.experience} onChange={set("experience")} type="number" />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <input style={inputStyle} value={form.country} onChange={set("country")} />
            </div>
            <div>
              <label style={labelStyle}>Visa Type</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={form.visa_type} onChange={set("visa_type")}>
                {["189","190","491","186"].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <button onClick={runPredict} disabled={loading} style={{
            width: "100%", padding: "12px 0", background: loading ? C.border : C.blue,
            border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "Running model..." : `Run POST /api/predict/${activeModel}`}
          </button>
          <p style={{ fontSize: 10, color: C.dimmed, marginTop: 8, textAlign: "center" }}>
            Models loaded at startup via joblib · SHAP explainability included
          </p>
        </Card>

        {/* Results */}
        <Card>
          <ChartHeader color={C.green}>Model Output</ChartHeader>
          {!result ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: C.muted }}>
              <p style={{ fontSize: 32, marginBottom: 12 }}>⊙</p>
              <p style={{ fontSize: 13 }}>Fill in the form and click Run to get predictions</p>
              <p style={{ fontSize: 11, marginTop: 6, color: C.dimmed }}>Returns: prediction, confidence, shap_values</p>
            </div>
          ) : (
            <div>
              <GaugeMeter value={result.prediction} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                <div style={{ background: C.bg, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>PREDICTION</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: C.green }}>{Math.round(result.prediction * 100)}%</p>
                </div>
                <div style={{ background: C.bg, borderRadius: 8, padding: 12, border: `1px solid ${C.border}` }}>
                  <p style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>CONFIDENCE</p>
                  <p style={{ fontSize: 20, fontWeight: 800, color: C.blue }}>{Math.round(result.confidence * 100)}%</p>
                </div>
              </div>

              {result.pathways && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>RANKED PATHWAYS</p>
                  {result.pathways.map((p: any) => (
                    <div key={p.visa} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", borderRadius: 6, background: C.bg, marginBottom: 6, border: `1px solid ${C.border}` }}>
                      <span style={{ fontSize: 12, color: C.text }}>{p.visa} · {p.state}</span>
                      <Badge label={`${Math.round(p.score * 100)}%`} color={p.score > 0.85 ? C.green : C.blue} />
                    </div>
                  ))}
                </div>
              )}

              {result.risk_flags && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: C.muted, marginBottom: 6, fontWeight: 600 }}>RISK FLAGS</p>
                  {result.risk_flags.map((f: string) => (
                    <div key={f} style={{ padding: "6px 10px", borderRadius: 5, background: `${C.amber}15`, border: `1px solid ${C.amber}40`, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: C.amber }}>⚠ {f}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: C.green, marginTop: 8, fontWeight: 600 }}>{result.recommendation}</p>
                </div>
              )}

              <p style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 600 }}>SHAP FEATURE IMPORTANCE</p>
              <SHAPChart shapValues={result.shap_values} />
            </div>
          )}
        </Card>
      </div>
    </PageWrapper>
  );
}
