"use client";
/**
 * Predictors — Sprint 4
 * Live ML model inference for:
 *   A) Pathway Predictor    → POST /api/predict/pathway
 *   B) Shortage Forecaster  → POST /api/predict/shortage  + GET /api/predict/shortage/top
 *   C) Volume Forecaster    → POST /api/predict/volume (mock)
 *   D) Approval Scorer      → POST /api/predict/approval
 */
import { useState, useEffect } from "react";
import { C, Card, PageWrapper } from "@/components/ui";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATES = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"];
const FORECAST_YEARS = ["2026", "2027", "2028", "2029", "2030"];

// ── colour helpers ─────────────────────────────────────────────────
function probColor(p: number) {
  if (p >= 0.7) return C.green;
  if (p >= 0.45) return C.amber;
  return "#ef4444";
}
function probLabel(p: number) {
  if (p >= 0.7) return "High";
  if (p >= 0.45) return "Medium";
  return "Low";
}

// ══════════════════════════════════════════════════════════════════
// MODEL STATUS BANNER
// ══════════════════════════════════════════════════════════════════
function ModelStatusBanner({ status }: { status: any }) {
  const eoiLoaded = status?.eoi_model?.loaded;
  const shLoaded = status?.shortage_model?.loaded;
  const allLive = eoiLoaded && shLoaded;

  return (
    <div
      style={{
        background: allLive ? `${C.green}12` : `${C.amber}12`,
        border: `1px solid ${allLive ? C.green : C.amber}40`,
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 24,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 28 }}>{allLive ? "🤖" : "⚠️"}</div>
      <div style={{ flex: 1 }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: allLive ? C.green : C.amber,
            marginBottom: 4,
          }}
        >
          {allLive
            ? "ML Models Live — Sprint 4 Active"
            : "Partial ML Deployment — Some models pending training"}
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "EOI Model (XGBoost)", loaded: eoiLoaded },
            { label: "Shortage Forecaster (RandomForest)", loaded: shLoaded },
          ].map((m) => (
            <span
              key={m.label}
              style={{
                fontSize: 11,
                color: m.loaded ? C.green : C.muted,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>{m.loaded ? "●" : "○"}</span> {m.label}
              {m.loaded &&
                status?.shortage_model?.meta?.roc_auc &&
                m.label.includes("Shortage") && (
                  <span style={{ color: C.muted }}>
                    (AUC {status.shortage_model.meta.roc_auc})
                  </span>
                )}
            </span>
          ))}
        </div>
      </div>
      {!allLive && (
        <div
          style={{
            background: `${C.bg}`,
            borderRadius: 8,
            padding: "8px 12px",
            border: `1px solid ${C.border}`,
          }}
        >
          <p
            style={{
              fontSize: 10,
              color: C.muted,
              fontFamily: "monospace",
              lineHeight: 1.7,
            }}
          >
            python ml/train_eoi_model.py
            <br />
            python ml/train_shortage_model.py
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// A) PATHWAY PREDICTOR
// ══════════════════════════════════════════════════════════════════
function PathwayPredictor() {
  const [anzsco, setAnzsco] = useState("261312");
  const [points, setPoints] = useState(85);
  const [visaType, setVisaType] = useState("190");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/api/predict/pathway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anzsco_code: anzsco,
          points,
          visa_type: visaType,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const chartData =
    result?.results?.map((r: any) => ({
      state: r.state,
      prob: r.probability ?? 0,
    })) ?? [];

  return (
    <Card style={{ borderLeft: `3px solid ${C.blue}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.blue,
            background: `${C.blue}18`,
            padding: "2px 8px",
            borderRadius: 4,
            border: `1px solid ${C.blue}35`,
          }}
        >
          Model A
        </span>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          Pathway Predictor
        </p>
        <span
          style={{
            fontSize: 10,
            color: C.muted,
            fontFamily: "monospace",
            marginLeft: "auto",
          }}
        >
          XGBoost
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: C.muted,
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        Ranks all states by EOI invitation probability for your occupation +
        points combination.
      </p>

      {/* Inputs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div>
          <label
            style={{
              fontSize: 10,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            ANZSCO Code
          </label>
          <input
            value={anzsco}
            onChange={(e) => setAnzsco(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: 12,
              fontFamily: "monospace",
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 10,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            Points Score
          </label>
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
            min={60}
            max={130}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: 12,
            }}
          />
        </div>
        <div>
          <label
            style={{
              fontSize: 10,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            Visa Type
          </label>
          <select
            value={visaType}
            onChange={(e) => setVisaType(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: 12,
            }}
          >
            <option value="189">189 — Skilled Independent</option>
            <option value="190">190 — State Sponsored</option>
            <option value="491">491 — Regional</option>
          </select>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{
          background: C.blue,
          color: "#fff",
          border: "none",
          borderRadius: 7,
          padding: "8px 20px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
          marginBottom: 16,
        }}
      >
        {loading ? "Running…" : "Predict Pathways"}
      </button>

      {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}

      {result && (
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <p style={{ fontSize: 11, color: C.muted }}>
              {result.status === "live"
                ? "🟢 Live model"
                : "🟡 Mock data — model not trained"}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ left: 0, right: 16 }}
            >
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 10, fill: C.muted }}
              />
              <YAxis
                type="category"
                dataKey="state"
                tick={{ fontSize: 11, fill: C.text }}
                width={36}
              />
              <Tooltip
                formatter={(v: any) => `${(v * 100).toFixed(1)}%`}
                contentStyle={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  fontSize: 11,
                }}
              />
              <Bar dataKey="prob" radius={[0, 4, 4, 0]}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={probColor(entry.prob)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Top result callout */}
          {chartData[0] && (
            <div
              style={{
                marginTop: 10,
                background: `${C.blue}0d`,
                borderRadius: 8,
                padding: "10px 14px",
                border: `1px solid ${C.blue}25`,
              }}
            >
              <p style={{ fontSize: 12, color: C.text }}>
                <span style={{ fontWeight: 700, color: C.blue }}>
                  {chartData[0].state}
                </span>{" "}
                is the best-fit state —{" "}
                <span
                  style={{
                    color: probColor(chartData[0].prob),
                    fontWeight: 700,
                  }}
                >
                  {(chartData[0].prob * 100).toFixed(1)}% invitation probability
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════
// B) SHORTAGE FORECASTER
// ══════════════════════════════════════════════════════════════════
function ShortageForecaster() {
  const [tab, setTab] = useState<"lookup" | "top">("top");
  const [anzsco, setAnzsco] = useState("252511");
  const [state, setState] = useState("NSW");
  const [topState, setTopState] = useState("NSW");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [topData, setTopData] = useState<any>(null);
  const [error, setError] = useState("");

  // Auto-load top shortages
  useEffect(() => {
    fetchTop(topState);
  }, [topState]);

  async function fetchTop(s: string) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API}/api/predict/shortage/top?state=${s}&limit=15`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTopData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function lookup() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/api/predict/shortage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anzsco_code: anzsco, state }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Chart for single-occupation lookup
  const lookupChart =
    result?.results?.flatMap((r: any) =>
      FORECAST_YEARS.map((y) => ({
        year: y,
        state: r.state,
        prob: r.forecast?.[y] ?? 0,
      })),
    ) ?? [];

  return (
    <Card style={{ borderLeft: `3px solid ${C.green}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.green,
            background: `${C.green}18`,
            padding: "2px 8px",
            borderRadius: 4,
            border: `1px solid ${C.green}35`,
          }}
        >
          Model B
        </span>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          Shortage Forecaster
        </p>
        <span
          style={{
            fontSize: 10,
            color: C.muted,
            fontFamily: "monospace",
            marginLeft: "auto",
          }}
        >
          RandomForest + Calibration
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: C.muted,
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        Predicts shortage probability per occupation per state for 2026–2030.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {(["top", "lookup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "5px 14px",
              borderRadius: 6,
              border: `1px solid ${C.border}`,
              background: tab === t ? C.green : C.bg,
              color: tab === t ? "#fff" : C.muted,
              fontSize: 11,
              fontWeight: tab === t ? 700 : 400,
              cursor: "pointer",
            }}
          >
            {t === "top" ? "Top Shortages by State" : "Lookup Occupation"}
          </button>
        ))}
      </div>

      {tab === "top" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => setTopState(s)}
                style={{
                  padding: "4px 12px",
                  borderRadius: 6,
                  border: `1px solid ${C.border}`,
                  background: topState === s ? C.green : C.bg,
                  color: topState === s ? "#fff" : C.muted,
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                {s}
              </button>
            ))}
          </div>

          {loading && <p style={{ fontSize: 12, color: C.muted }}>Loading…</p>}
          {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}

          {topData?.results && (
            <>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 8 }}>
                {topData.status === "live"
                  ? "🟢 Live model"
                  : "🟡 Mock data — model not trained"}{" "}
                · Top shortages in{" "}
                <strong style={{ color: C.text }}>{topState}</strong>
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {topData.results.map((row: any, i: number) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: C.bg,
                      borderRadius: 7,
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <span
                      style={{ fontSize: 10, color: C.muted, minWidth: 20 }}
                    >
                      #{i + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.muted,
                        fontFamily: "monospace",
                        minWidth: 60,
                      }}
                    >
                      {row.code}
                    </span>
                    <span style={{ fontSize: 12, color: C.text, flex: 1 }}>
                      {row.occupation}
                    </span>
                    {FORECAST_YEARS.map((y) => (
                      <div
                        key={y}
                        style={{ textAlign: "center", minWidth: 44 }}
                      >
                        <p
                          style={{
                            fontSize: 9,
                            color: C.muted,
                            marginBottom: 2,
                          }}
                        >
                          {y}
                        </p>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: probColor(row[`prob_${y}`] ?? 0),
                          }}
                        >
                          {((row[`prob_${y}`] ?? 0) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {tab === "lookup" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 10,
                  color: C.muted,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                ANZSCO Code
              </label>
              <input
                value={anzsco}
                onChange={(e) => setAnzsco(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 10,
                  color: C.muted,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                State
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  background: C.bg,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  fontSize: 12,
                }}
              >
                <option value="">All States</option>
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={lookup}
            disabled={loading}
            style={{
              background: C.green,
              color: "#fff",
              border: "none",
              borderRadius: 7,
              padding: "8px 20px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              opacity: loading ? 0.6 : 1,
              marginBottom: 16,
            }}
          >
            {loading ? "Loading…" : "Get Forecast"}
          </button>

          {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}

          {result?.results && result.results.length > 0 && (
            <>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>
                {result.status === "live" ? "🟢 Live model" : "🟡 Mock"} ·
                ANZSCO {result.anzsco_code}
              </p>
              {result.results.map((r: any) => {
                const lineData = FORECAST_YEARS.map((y) => ({
                  year: y,
                  prob: r.forecast?.[y] ?? 0,
                }));
                return (
                  <div key={r.state} style={{ marginBottom: 16 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: C.text,
                        marginBottom: 6,
                      }}
                    >
                      {r.state}
                    </p>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={lineData}>
                        <XAxis
                          dataKey="year"
                          tick={{ fontSize: 10, fill: C.muted }}
                        />
                        <YAxis
                          domain={[0, 1]}
                          tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                          tick={{ fontSize: 10, fill: C.muted }}
                        />
                        <Tooltip
                          formatter={(v: any) => `${(v * 100).toFixed(1)}%`}
                          contentStyle={{
                            background: C.surface,
                            border: `1px solid ${C.border}`,
                            borderRadius: 6,
                            fontSize: 11,
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="prob"
                          stroke={C.green}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
            </>
          )}
        </>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════
// D) APPROVAL SCORER
// ══════════════════════════════════════════════════════════════════
function ApprovalScorer() {
  const [anzsco, setAnzsco] = useState("261312");
  const [points, setPoints] = useState(85);
  const [state, setState] = useState("VIC");
  const [visaType, setVisaType] = useState("190");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  async function run() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`${API}/api/predict/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          anzsco_code: anzsco,
          points,
          state,
          visa_type: visaType,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setResult(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const prob = result?.probability;

  return (
    <Card style={{ borderLeft: `3px solid ${C.amber}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.amber,
            background: `${C.amber}18`,
            padding: "2px 8px",
            borderRadius: 4,
            border: `1px solid ${C.amber}35`,
          }}
        >
          Model D
        </span>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          Approval Scorer
        </p>
        <span
          style={{
            fontSize: 10,
            color: C.muted,
            fontFamily: "monospace",
            marginLeft: "auto",
          }}
        >
          XGBoost
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: C.muted,
          marginBottom: 14,
          lineHeight: 1.5,
        }}
      >
        Estimates invitation probability for a specific occupation + state +
        points combination.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          marginBottom: 12,
        }}
      >
        {[
          { label: "ANZSCO Code", val: anzsco, set: setAnzsco, mono: true },
          {
            label: "Points Score",
            val: points,
            set: (v: string) => setPoints(Number(v)),
            type: "number",
          },
        ].map((f) => (
          <div key={f.label}>
            <label
              style={{
                fontSize: 10,
                color: C.muted,
                display: "block",
                marginBottom: 4,
              }}
            >
              {f.label}
            </label>
            <input
              type={f.type || "text"}
              value={f.val}
              onChange={(e) => f.set(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px",
                background: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                color: C.text,
                fontSize: 12,
                fontFamily: f.mono ? "monospace" : undefined,
              }}
            />
          </div>
        ))}
        <div>
          <label
            style={{
              fontSize: 10,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            State
          </label>
          <select
            value={state}
            onChange={(e) => setState(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: 12,
            }}
          >
            {STATES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              fontSize: 10,
              color: C.muted,
              display: "block",
              marginBottom: 4,
            }}
          >
            Visa Type
          </label>
          <select
            value={visaType}
            onChange={(e) => setVisaType(e.target.value)}
            style={{
              width: "100%",
              padding: "7px 10px",
              background: C.bg,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.text,
              fontSize: 12,
            }}
          >
            <option value="189">189 — Skilled Independent</option>
            <option value="190">190 — State Sponsored</option>
            <option value="491">491 — Regional</option>
          </select>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{
          background: C.amber,
          color: "#000",
          border: "none",
          borderRadius: 7,
          padding: "8px 20px",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          opacity: loading ? 0.6 : 1,
          marginBottom: 16,
        }}
      >
        {loading ? "Scoring…" : "Score Approval"}
      </button>

      {error && <p style={{ fontSize: 12, color: "#ef4444" }}>{error}</p>}

      {result && prob !== null && prob !== undefined && (
        <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
          {/* Gauge */}
          <div
            style={{
              textAlign: "center",
              background: C.bg,
              borderRadius: 10,
              padding: "16px 24px",
              border: `1px solid ${C.border}`,
              minWidth: 120,
            }}
          >
            <p
              style={{
                fontSize: 36,
                fontWeight: 800,
                color: probColor(prob),
                marginBottom: 4,
              }}
            >
              {(prob * 100).toFixed(0)}%
            </p>
            <p
              style={{ fontSize: 11, color: probColor(prob), fontWeight: 700 }}
            >
              {probLabel(prob)}
            </p>
            <p style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>
              invitation probability
            </p>
            <p style={{ fontSize: 9, color: C.muted, marginTop: 2 }}>
              {result.status === "live" ? "🟢 live" : "🟡 mock"}
            </p>
          </div>

          {/* Risk flags */}
          {result.risk_flags?.length > 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {result.risk_flags.map((flag: string, i: number) => (
                <div
                  key={i}
                  style={{
                    padding: "8px 12px",
                    background: C.bg,
                    borderRadius: 7,
                    border: `1px solid ${C.border}`,
                    fontSize: 12,
                    color: C.text,
                    lineHeight: 1.4,
                  }}
                >
                  {prob >= 0.7 ? "✅" : prob >= 0.45 ? "⚠️" : "❌"} {flag}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════
// C) VOLUME FORECASTER (placeholder)
// ══════════════════════════════════════════════════════════════════
function VolumeForecaster() {
  return (
    <Card style={{ borderLeft: `3px solid ${C.purple}` }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: C.purple,
            background: `${C.purple}18`,
            padding: "2px 8px",
            borderRadius: 4,
            border: `1px solid ${C.purple}35`,
          }}
        >
          Model C
        </span>
        <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
          Volume Forecaster
        </p>
        <span
          style={{
            fontSize: 10,
            color: C.muted,
            fontFamily: "monospace",
            marginLeft: "auto",
          }}
        >
          Prophet (Meta)
        </span>
        <span
          style={{
            fontSize: 10,
            background: `${C.muted}20`,
            color: C.muted,
            padding: "2px 8px",
            borderRadius: 4,
          }}
        >
          Sprint 4b
        </span>
      </div>
      <p
        style={{
          fontSize: 12,
          color: C.muted,
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        Time-series model forecasting monthly invitation volumes to December
        2030, accounting for seasonality and policy changes.
      </p>
      <div
        style={{
          background: `${C.purple}0d`,
          borderRadius: 8,
          padding: "12px 16px",
          border: `1px solid ${C.purple}25`,
        }}
      >
        <p
          style={{
            fontSize: 11,
            color: C.purple,
            fontWeight: 600,
            marginBottom: 6,
          }}
        >
          Requires: Prophet + additional EOI volume data
        </p>
        <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.6 }}>
          1. Install prophet in requirements.txt
          <br />
          2. Build monthly invitation time series from eoi_records
          <br />
          3. Train Prophet model per occupation/state
          <br />
          4. Serialize and expose via /api/predict/volume
        </p>
      </div>
    </Card>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function Predictors() {
  const [modelStatus, setModelStatus] = useState<any>(null);

  useEffect(() => {
    fetch(`${API}/api/predict/models`)
      .then((r) => r.json())
      .then(setModelStatus)
      .catch(() => {});
  }, []);

  return (
    <PageWrapper
      title="ML Predictors"
      sub="Sprint 4 — Real-time model inference"
    >
      <ModelStatusBanner status={modelStatus} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <PathwayPredictor />
        <ShortageForecaster />
        <ApprovalScorer />
        <VolumeForecaster />
      </div>
    </PageWrapper>
  );
}
