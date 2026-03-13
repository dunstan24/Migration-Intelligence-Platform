"use client";
/**
 * Visa Approval Probability Scorer
 * Route:  /dashboard/approval
 * Model:  XGBoost (model_xgb.pkl) — binary:logistic
 * Target: 0 = Submitted/Waiting · 1 = Lodged/Approved
 */
import { useState, useEffect, useRef } from "react";
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { C, Card } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"];
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
const VISA_OPTIONS = [
  { value: "189", label: "189 — Skilled Independent (Points-Tested)" },
  { value: "190", label: "190 — State Nominated (Skilled)" },
  { value: "491", label: "491 — Skilled Work Regional (Provisional)" },
];

const probColor = (p: number) =>
  p >= 0.8
    ? C.green
    : p >= 0.6
      ? C.blue
      : p >= 0.4
        ? C.amber
        : p >= 0.2
          ? "#f97316"
          : "#ef4444";

// ── Shared styles ─────────────────────────────────────────────
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

function FieldLabel({ text, sub }: { text: string; sub?: string }) {
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

// ── Occupation autocomplete ───────────────────────────────────
function OccupationSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const timer = useRef<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = (q: string) => {
    setQuery(q);
    onChange(q);
    setConfirmed(false);
    clearTimeout(timer.current);
    if (!q) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(
          `${API}/api/predict/approval/occupations?q=${encodeURIComponent(q)}`,
        );
        const d = await r.json();
        setResults(d.occupations || []);
        setOpen(true);
      } catch {
      } finally {
        setLoading(false);
      }
    }, 250);
  };

  const pick = (occ: string) => {
    setQuery(occ);
    onChange(occ);
    setConfirmed(true);
    setOpen(false);
    setResults([]);
  };

  // Highlight matching substring
  const highlight = (occ: string, q: string) => {
    const idx = occ.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1 || !q) return <span>{occ}</span>;
    return (
      <span>
        {occ.slice(0, idx)}
        <span style={{ color: C.blue, fontWeight: 700 }}>
          {occ.slice(idx, idx + q.length)}
        </span>
        {occ.slice(idx + q.length)}
      </span>
    );
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          style={{
            ...inp,
            paddingRight: 34,
            borderColor: confirmed ? C.green : `${C.border}`,
          }}
          value={query}
          onChange={(e) => search(e.target.value)}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder="Type ANZSCO code or occupation name…"
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 10,
              color: C.muted,
            }}
          >
            …
          </span>
        )}
        {confirmed && !loading && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 14,
              color: C.green,
            }}
          >
            ✓
          </span>
        )}
      </div>

      {confirmed && (
        <div
          style={{
            marginTop: 6,
            padding: "7px 12px",
            background: `${C.green}10`,
            border: `1px solid ${C.green}30`,
            borderRadius: 6,
          }}
        >
          <p style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>
            {query.split(" ")[0]} · {query.split(" ").slice(1).join(" ")}
          </p>
        </div>
      )}

      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 100,
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            maxHeight: 220,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {results.map((occ) => (
            <div
              key={occ}
              onClick={() => pick(occ)}
              style={{
                padding: "8px 14px",
                cursor: "pointer",
                fontSize: 12,
                color: C.text,
                borderBottom: `1px solid ${C.border}22`,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `${C.blue}18`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                style={{
                  fontSize: 10,
                  color: C.muted,
                  background: `${C.border}60`,
                  padding: "2px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {occ.split(" ")[0]}
              </span>
              <span>{highlight(occ.split(" ").slice(1).join(" "), query)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Radial gauge ──────────────────────────────────────────────
function ProbGauge({ prob }: { prob: number }) {
  const pct = Math.round(prob * 100);
  const col = probColor(prob);
  return (
    <div
      style={{
        position: "relative",
        width: 180,
        height: 180,
        margin: "0 auto",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          barSize={14}
          data={[{ value: pct, fill: col }]}
          startAngle={225}
          endAngle={-45}
        >
          <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            background={{ fill: `${C.border}60` }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <p style={{ fontSize: 34, fontWeight: 900, color: col, lineHeight: 1 }}>
          {pct}%
        </p>
        <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
          Approval Prob.
        </p>
      </div>
    </div>
  );
}

// ── Feature importance bar ────────────────────────────────────
function ImpBar({
  name,
  value,
  max,
}: {
  name: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const short = name
    .replace("Nominated State_", "State: ")
    .replace("Visa Type_", "Visa: ")
    .replace(/_submitted/g, "")
    .replace(/_/g, " ")
    .slice(0, 30);
  return (
    <div style={{ marginBottom: 7 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <span style={{ fontSize: 10, color: C.muted }}>{short}</span>
        <span style={{ fontSize: 10, color: C.text }}>
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: `${C.border}60` }}>
        <div
          style={{
            height: "100%",
            borderRadius: 3,
            width: `${pct}%`,
            background: C.blue,
            transition: "width 0.4s",
          }}
        />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function ApprovalScorer() {
  const [form, setForm] = useState({
    visa_type: "491",
    occupation: "261313 Software Engineer",
    points: 80,
    count_eois: 50,
    state: "NSW",
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [whatIfData, setWhatIfData] = useState<any[]>([]);
  const [whatIfLoad, setWhatIfLoad] = useState(false);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch(`${API}/api/predict/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          points: Number(form.points),
          count_eois: Number(form.count_eois),
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

  const runWhatIf = async () => {
    setWhatIfLoad(true);
    const out: any[] = [];
    await Promise.allSettled(
      STATES.map(async (st) => {
        try {
          const r = await fetch(`${API}/api/predict/approval`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              state: st,
              points: Number(form.points),
              count_eois: Number(form.count_eois),
            }),
          });
          const d = await r.json();
          if (d.probability !== undefined)
            out.push({ state: st, prob: d.probability });
        } catch {}
      }),
    );
    out.sort((a, b) => b.prob - a.prob);
    setWhatIfData(out);
    setWhatIfLoad(false);
  };

  const topImp = result?.top_feature_importance ?? {};
  const impMax = Math.max(...Object.values(topImp).map(Number), 0.001);

  return (
    <div
      style={{
        padding: "24px 28px",
        maxWidth: 1360,
        background: C.bg,
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#f9fafb" }}>
            Visa Approval Probability Scorer
          </h1>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              background: `${C.green}20`,
              color: C.green,
              border: `1px solid ${C.green}40`,
            }}
          >
            XGBoost
          </span>
        </div>
        <p style={{ fontSize: 13, color: C.muted }}>
          Predicts EOI lodgement probability · 0 = Still Submitted/Waiting · 1 =
          Lodged/Approved
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* ── FORM ──────────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: C.text,
                marginBottom: 16,
              }}
            >
              EOI Profile
            </p>

            {/* Visa Type */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel text="Visa Type" />
              <select
                style={sel}
                value={form.visa_type}
                onChange={(e) => set("visa_type", e.target.value)}
              >
                {VISA_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Occupation */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel
                text="Occupation"
                sub="Type ANZSCO code or name — 386 occupations supported"
              />
              <OccupationSearch
                value={form.occupation}
                onChange={(v) => set("occupation", v)}
              />
            </div>

            {/* Points */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel text="Points Score" sub={`${form.points} pts`} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={35}
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
                    minWidth: 36,
                    textAlign: "right",
                  }}
                >
                  {form.points}
                </span>
              </div>
              {/* Points bucket pills */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  marginTop: 8,
                  flexWrap: "wrap",
                }}
              >
                {[
                  { label: "60+ 491 min", min: 60, max: 64 },
                  { label: "65+ 190 min", min: 65, max: 69 },
                  { label: "80+ Good", min: 80, max: 89 },
                  { label: "95+ Strong", min: 95, max: 140 },
                ].map((b) => {
                  const active = form.points >= b.min && form.points <= b.max;
                  return (
                    <span
                      key={b.label}
                      style={{
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 20,
                        background: active ? `${C.blue}25` : "transparent",
                        border: `1px solid ${active ? C.blue : C.border}`,
                        color: active ? C.blue : C.muted,
                        fontWeight: active ? 700 : 400,
                      }}
                    >
                      {b.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Count EOIs */}
            <div style={{ marginBottom: 14 }}>
              <FieldLabel
                text="Count EOIs in Cohort"
                sub="How many EOIs in same occupation/state/visa group"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={1}
                  max={500}
                  value={form.count_eois}
                  onChange={(e) => set("count_eois", Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.cyan }}
                />
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: C.cyan,
                    minWidth: 36,
                    textAlign: "right",
                  }}
                >
                  {form.count_eois}
                </span>
              </div>
              <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
                {form.count_eois <= 20
                  ? "↓ Small queue — typically higher probability"
                  : form.count_eois >= 100
                    ? "↑ Large queue — more competition"
                    : "Medium queue size"}
              </p>
            </div>

            {/* State */}
            <div style={{ marginBottom: 20 }}>
              <FieldLabel text="Nominated State" />
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
                marginBottom: 8,
              }}
            >
              {loading ? "Running XGBoost…" : "⚡  Score Approval"}
            </button>

            <button
              onClick={runWhatIf}
              disabled={whatIfLoad}
              style={{
                width: "100%",
                padding: "10px 0",
                borderRadius: 8,
                border: `1px solid ${C.purple}`,
                cursor: whatIfLoad ? "not-allowed" : "pointer",
                background: "transparent",
                color: C.purple,
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {whatIfLoad ? "Checking all states…" : "🔀  What-If: All States"}
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
              ["Algorithm", "XGBoost (binary:logistic)"],
              ["Features", "32 engineered features"],
              ["Occupations", "386 via LabelEncoder"],
              ["Visa Support", "189, 190, 491"],
              ["Target", "0 = Submitted · 1 = Lodged"],
              ["File", "model_xgb.pkl"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  borderBottom: `1px solid ${C.border}22`,
                }}
              >
                <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
                <span style={{ fontSize: 11, color: C.text }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* ── RESULTS ───────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Placeholder */}
          {!result && whatIfData.length === 0 && (
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
                <p style={{ fontSize: 40, marginBottom: 12 }}>🎯</p>
                <p style={{ fontSize: 14, color: C.muted }}>
                  Fill in the profile and click Score Approval
                </p>
                <p style={{ fontSize: 11, color: "#374151", marginTop: 6 }}>
                  XGBoost model · 386 occupations · 32 engineered features
                </p>
              </div>
            </div>
          )}

          {/* Main result */}
          {result && (
            <>
              {/* Hero card */}
              <div
                style={{
                  background: `${probColor(result.probability)}10`,
                  border: `1px solid ${probColor(result.probability)}40`,
                  borderRadius: 14,
                  padding: "24px 28px",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 200px",
                    gap: 24,
                    alignItems: "center",
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
                        marginBottom: 8,
                      }}
                    >
                      XGBoost Prediction
                    </p>
                    <p
                      style={{
                        fontSize: 28,
                        fontWeight: 900,
                        color: probColor(result.probability),
                        marginBottom: 6,
                      }}
                    >
                      {result.label}
                    </p>
                    <p
                      style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}
                    >
                      {result.interpretation}
                    </p>

                    {/* Input chips */}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 14,
                      }}
                    >
                      {[
                        { l: "Visa", v: result.inputs.visa_type },
                        { l: "Points", v: `${result.inputs.points} pts` },
                        { l: "State", v: result.inputs.state },
                        { l: "EOI Count", v: result.inputs.count_eois },
                      ].map((k) => (
                        <div
                          key={k.l}
                          style={{
                            padding: "6px 14px",
                            background: `${C.border}40`,
                            borderRadius: 8,
                          }}
                        >
                          <p style={{ fontSize: 9, color: C.muted }}>{k.l}</p>
                          <p
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: C.text,
                            }}
                          >
                            {k.v}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Occupation status */}
                    <div
                      style={{
                        padding: "8px 12px",
                        background: result.occupation_known
                          ? `${C.green}10`
                          : `${C.amber}10`,
                        border: `1px solid ${result.occupation_known ? C.green + "40" : C.amber + "40"}`,
                        borderRadius: 8,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: result.occupation_known ? C.green : C.amber,
                        }}
                      >
                        {result.occupation_known
                          ? "✓ Occupation recognised by encoder"
                          : "⚠ Occupation not in encoder — estimated"}
                      </p>
                      <p style={{ fontSize: 12, color: C.text, marginTop: 2 }}>
                        {result.inputs.occupation}
                      </p>
                    </div>
                  </div>

                  {/* Gauge */}
                  <div>
                    <ProbGauge prob={result.probability} />
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: 12,
                        color: C.muted,
                        marginTop: 8,
                      }}
                    >
                      {result.prediction === 1
                        ? "✅ Predicted: Lodged"
                        : "⏳ Predicted: Waiting"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature importance */}
              {Object.keys(topImp).length > 0 && (
                <Card>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.text,
                      marginBottom: 14,
                    }}
                  >
                    Top Feature Importances
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0 28px",
                    }}
                  >
                    {Object.entries(topImp).map(([name, val]) => (
                      <ImpBar
                        key={name}
                        name={name}
                        value={Number(val)}
                        max={impMax}
                      />
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}

          {/* What-If: all states */}
          {whatIfData.length > 0 && (
            <Card>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: C.text,
                  marginBottom: 4,
                }}
              >
                What-If: Approval Probability Across All States
              </p>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 14 }}>
                {form.occupation} · Visa {form.visa_type} · {form.points} pts ·{" "}
                {form.count_eois} EOIs
              </p>

              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={whatIfData}
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
                      "Approval Prob",
                    ]}
                    contentStyle={{
                      background: C.surface,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="prob" radius={[4, 4, 0, 0]}>
                    {whatIfData.map((d: any) => (
                      <Cell
                        key={d.state}
                        fill={STATE_COLORS[d.state] || C.muted}
                        opacity={d.state === form.state ? 1 : 0.6}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* State ranking grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4,1fr)",
                  gap: 8,
                  marginTop: 14,
                }}
              >
                {whatIfData.map((d: any, i: number) => (
                  <div
                    key={d.state}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      background:
                        d.state === form.state
                          ? `${STATE_COLORS[d.state] || C.muted}20`
                          : "transparent",
                      border: `1px solid ${
                        d.state === form.state
                          ? (STATE_COLORS[d.state] || C.muted) + "50"
                          : C.border
                      }`,
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
                          fontSize: 12,
                          fontWeight: 700,
                          color: STATE_COLORS[d.state] || C.muted,
                        }}
                      >
                        {d.state}
                      </span>
                      <span style={{ fontSize: 10, color: C.muted }}>
                        #{i + 1}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                        color: probColor(d.prob),
                      }}
                    >
                      {(d.prob * 100).toFixed(1)}%
                    </p>
                    {d.state === form.state && (
                      <p style={{ fontSize: 9, color: C.green }}>★ Selected</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Best state banner */}
              {whatIfData[0] && (
                <div
                  style={{
                    marginTop: 14,
                    padding: "12px 16px",
                    background: `${C.green}10`,
                    border: `1px solid ${C.green}30`,
                    borderRadius: 10,
                  }}
                >
                  <p style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>
                    🏆 Best state for this profile: {whatIfData[0].state} —{" "}
                    {(whatIfData[0].prob * 100).toFixed(1)}% approval
                    probability
                  </p>
                  {whatIfData[0].state !== form.state && (
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      Your selected state ({form.state}):{" "}
                      {(
                        (whatIfData.find((d: any) => d.state === form.state)
                          ?.prob || 0) * 100
                      ).toFixed(1)}
                      %
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
