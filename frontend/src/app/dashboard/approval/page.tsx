"use client";
/**
 * Visa Approval Probability Scorer
 * Route: /dashboard/approval
 * Model: XGBoost (model_xgb.pkl) — binary:logistic
 *
 * Features (inspired by friend's EOI Lodge Predictor):
 *  - Occupation autocomplete (386 occupations, ANZSCO code badge)
 *  - Multi-state chip selection — predict all states at once
 *  - Auto lookup: pulls historical EOI stats for the combination
 *  - Manual EOI input: paste monthly counts, auto-computes stats
 *  - Results ranked by probability with mini progress bar per state
 */
import { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { C, Card } from "@/components/ui";

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

const ALL_STATES = ["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"];
const VISA_OPTIONS = [
  {
    value: "189PTS Points-Tested Stream",
    label: "189 — Points-Tested Stream (Independent)",
  },
  {
    value: "190SAS Skilled Australian Sponsored",
    label: "190 — Skilled Australian Sponsored",
  },
  {
    value: "491SNR State or Territory Nominated - Regional",
    label: "491 — State/Territory Nominated Regional",
  },
  {
    value: "491FSR Family Sponsored - Regional",
    label: "491 — Family Sponsored Regional",
  },
];
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

// ── Styles ────────────────────────────────────────────────────
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
const sectionTitle: any = {
  fontSize: 10,
  fontWeight: 700,
  color: C.muted,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 10,
};

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
  const [selected, setSelected] = useState(value);
  const timer = useRef<any>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const handleInput = (q: string) => {
    setQuery(q);
    onChange(q);
    setSelected("");
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
    setSelected(occ);
    onChange(occ);
    setOpen(false);
    setResults([]);
  };

  const code = selected ? selected.split(" ")[0] : "";
  const name = selected ? selected.split(" ").slice(1).join(" ") : "";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={{ position: "relative" }}>
        <input
          style={{ ...inp, paddingRight: 26 }}
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder="e.g. Software Engineer, Chef, 261313…"
        />
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 9,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 11,
              color: C.blue,
            }}
          >
            ⟳
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 200,
            background: "#0d1117",
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            maxHeight: 240,
            overflowY: "auto",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
          }}
        >
          <div
            style={{
              padding: "5px 12px",
              borderBottom: `1px solid ${C.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              background: "#0d1117",
            }}
          >
            <span style={{ fontSize: 10, color: C.muted }}>
              {results.length} results
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: C.muted,
                cursor: "pointer",
                fontSize: 13,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
          {results.map((occ) => {
            const c = occ.split(" ")[0];
            const n = occ.split(" ").slice(1).join(" ");
            const isSel = occ === selected;
            const ql = query.toLowerCase();
            const ni = n.toLowerCase().indexOf(ql);
            return (
              <div
                key={occ}
                onClick={() => pick(occ)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: isSel ? `${C.blue}15` : "transparent",
                  borderBottom: `1px solid ${C.border}18`,
                }}
                onMouseEnter={(e) => {
                  if (!isSel) e.currentTarget.style.background = `${C.blue}0e`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isSel
                    ? `${C.blue}15`
                    : "transparent";
                }}
              >
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 800,
                    background: isSel ? `${C.blue}30` : `${C.border}50`,
                    color: isSel ? C.blue : C.muted,
                    fontFamily: "monospace",
                    flexShrink: 0,
                  }}
                >
                  {c}
                </span>
                <span style={{ fontSize: 12, color: C.text, flex: 1 }}>
                  {ni >= 0 ? (
                    <>
                      {n.slice(0, ni)}
                      <span
                        style={{
                          background: `${C.blue}40`,
                          color: C.blue,
                          borderRadius: 2,
                          padding: "0 1px",
                        }}
                      >
                        {n.slice(ni, ni + query.length)}
                      </span>
                      {n.slice(ni + query.length)}
                    </>
                  ) : (
                    n
                  )}
                </span>
                {isSel && (
                  <span style={{ color: C.green, fontSize: 12 }}>✓</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div
          style={{
            marginTop: 8,
            padding: "7px 10px",
            borderRadius: 8,
            background: `${C.green}10`,
            border: `1px solid ${C.green}30`,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 5,
              fontSize: 11,
              fontWeight: 800,
              background: `${C.green}25`,
              color: C.green,
              fontFamily: "monospace",
            }}
          >
            {code}
          </span>
          <span style={{ fontSize: 12, color: C.text, flex: 1 }}>{name}</span>
          <button
            onClick={() => {
              setSelected("");
              setQuery("");
              onChange("");
            }}
            style={{
              background: "none",
              border: "none",
              color: C.muted,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ── Compute stats from monthly values ────────────────────────
function computeStats(values: number[]) {
  if (values.length < 2) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const std = Math.sqrt(
    values.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / values.length,
  );
  const trend = values[values.length - 1] - values[0];
  const growth = values[0] > 0 ? values[values.length - 1] / values[0] : 1.0;
  return {
    avg_count_submitted: parseFloat(avg.toFixed(1)),
    max_count_submitted: max,
    min_count_submitted: min,
    std_count_submitted: parseFloat(std.toFixed(1)),
    trend_submitted: parseFloat(trend.toFixed(1)),
    last_count_submitted: values[values.length - 1],
    first_count_submitted: values[0],
    total_months_observed: values.length,
    growth_rate: parseFloat(growth.toFixed(2)),
  };
}

// ── Main page ─────────────────────────────────────────────────
export default function ApprovalScorer() {
  // Form
  const [occupation, setOccupation] = useState("");
  const [visaType, setVisaType] = useState(
    "491SNR State or Territory Nominated - Regional",
  );
  const [points, setPoints] = useState(80);
  const [selStates, setSelStates] = useState<string[]>(["NSW"]);

  // EOI data mode
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [manualInput, setManualInput] = useState("");
  const [manualStats, setManualStats] = useState<any>(null);
  const [autoStats, setAutoStats] = useState<Record<string, any>>({});
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const [lookupInfo, setLookupInfo] = useState<{
    found: string[];
    notFound: string[];
  }>({ found: [], notFound: [] });

  // Results
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(0.5);

  // Load threshold on mount
  useEffect(() => {
    fetch(`${API}/api/predict/approval/threshold`)
      .then((r) => r.json())
      .then((d) => setThreshold(d.threshold ?? 0.5))
      .catch(() => {});
  }, []);

  // Auto lookup whenever key fields change
  useEffect(() => {
    if (
      !occupation ||
      !visaType ||
      !points ||
      selStates.length === 0 ||
      mode !== "auto"
    )
      return;
    const timer = setTimeout(() => doLookup(), 400);
    return () => clearTimeout(timer);
  }, [occupation, visaType, points, selStates, mode]);

  const doLookup = async () => {
    if (!occupation || !visaType || !points || selStates.length === 0) return;
    setLookupStatus("loading");
    const res = await Promise.allSettled(
      selStates.map(async (st) => {
        const params = new URLSearchParams({
          occupation,
          visa_type: visaType,
          state: st,
          points: String(points),
        });
        const r = await fetch(`${API}/api/predict/approval/lookup?${params}`);
        return { state: st, data: await r.json() };
      }),
    );
    const newStats: Record<string, any> = {};
    const found: string[] = [],
      notFound: string[] = [];
    res.forEach((r) => {
      if (r.status === "fulfilled") {
        const { state, data } = r.value;
        if (data.found) {
          newStats[state] = data;
          found.push(state);
        } else notFound.push(state);
      }
    });
    setAutoStats(newStats);
    setLookupInfo({ found, notFound });
    setLookupStatus("done");
  };

  const parseManual = (raw: string) => {
    setManualInput(raw);
    const values = raw
      .split(",")
      .map((v) => parseFloat(v.trim()))
      .filter((v) => !isNaN(v));
    setManualStats(values.length >= 2 ? computeStats(values) : null);
  };

  const toggleState = (st: string) => {
    setSelStates((s) =>
      s.includes(st) ? s.filter((x) => x !== st) : [...s, st],
    );
  };

  const canPredict = occupation && visaType && points && selStates.length > 0;

  const runPredict = async () => {
    setLoading(true);
    setError("");
    setResults([]);
    try {
      const promises = selStates.map(async (st) => {
        const stats =
          mode === "manual" ? (manualStats ?? {}) : (autoStats[st] ?? {});
        const body = {
          occupation,
          visa_type: visaType,
          state: st,
          points,
          avg_count_submitted: stats.avg_count_submitted ?? 50,
          max_count_submitted: stats.max_count_submitted ?? 100,
          min_count_submitted: stats.min_count_submitted ?? 10,
          std_count_submitted: stats.std_count_submitted ?? 20,
          trend_submitted: stats.trend_submitted ?? 0,
          last_count_submitted: stats.last_count_submitted ?? 50,
          first_count_submitted: stats.first_count_submitted ?? 50,
          total_months_observed: stats.total_months_observed ?? 12,
          growth_rate: stats.growth_rate ?? 1.0,
        };
        const r = await fetch(`${API}/api/predict/approval`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        return { state: st, ...d };
      });
      const res = await Promise.all(promises);
      setResults(res.sort((a, b) => b.probability - a.probability));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const anyLodgeable = results.some((r) => r.probability >= threshold * 100);

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
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
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
          Predicts EOI lodgement probability · threshold:{" "}
          {(threshold * 100).toFixed(0)}% · 0 = Submitted/Waiting · 1 =
          Lodged/Approved
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
        {/* ── LEFT FORM ─────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Card>
            {/* === VISA INFO === */}
            <p style={sectionTitle}>Visa Information</p>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>
                Occupation
              </p>
              <OccupationSearch value={occupation} onChange={setOccupation} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>
                Visa Type
              </p>
              <select
                style={sel}
                value={visaType}
                onChange={(e) => setVisaType(e.target.value)}
              >
                {VISA_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>
                Points —{" "}
                <span style={{ color: C.blue, fontWeight: 700 }}>
                  {points} pts
                </span>
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="range"
                  min={35}
                  max={140}
                  value={points}
                  onChange={(e) => setPoints(Number(e.target.value))}
                  style={{ flex: 1, accentColor: C.blue }}
                />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: C.blue,
                    minWidth: 34,
                    textAlign: "right",
                  }}
                >
                  {points}
                </span>
              </div>
              {/* Bucket bar */}
              <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
                {[60, 65, 70, 75, 80, 85, 90, 100].map((t) => (
                  <div
                    key={t}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 2,
                      background: points >= t ? C.blue : `${C.border}60`,
                    }}
                  />
                ))}
              </div>
            </div>

            {/* === STATE CHIPS === */}
            <p style={sectionTitle}>Nominated State</p>
            <p style={{ fontSize: 10, color: C.muted, marginBottom: 8 }}>
              Select one or more states — predict all at once
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 16,
              }}
            >
              {ALL_STATES.map((st) => {
                const active = selStates.includes(st);
                return (
                  <button
                    key={st}
                    onClick={() => toggleState(st)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: `1.5px solid ${active ? STATE_COLORS[st] || C.blue : C.border}`,
                      background: active
                        ? `${STATE_COLORS[st] || C.blue}22`
                        : "transparent",
                      color: active ? STATE_COLORS[st] || C.blue : C.muted,
                      transition: "all 0.15s",
                    }}
                  >
                    {st}
                  </button>
                );
              })}
            </div>

            {/* === EOI DATA === */}
            <p style={sectionTitle}>EOI Count Data</p>

            {/* Mode toggle */}
            <div
              style={{
                display: "flex",
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${C.border}`,
                marginBottom: 12,
              }}
            >
              {(["auto", "manual"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    fontSize: 12,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    background: mode === m ? C.blue : "transparent",
                    color: mode === m ? "#fff" : C.muted,
                  }}
                >
                  {m === "auto" ? "🔄 Auto (Historical)" : "✏️ Manual Input"}
                </button>
              ))}
            </div>

            {/* Auto mode */}
            {mode === "auto" && (
              <div>
                {lookupStatus === "loading" && (
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      fontSize: 12,
                      color: C.muted,
                      background: `${C.border}30`,
                    }}
                  >
                    ⟳ Looking up historical data…
                  </div>
                )}
                {lookupStatus === "done" && (
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  >
                    {lookupInfo.found.length > 0 && (
                      <div
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          background: `${C.green}10`,
                          border: `1px solid ${C.green}30`,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 11,
                            color: C.green,
                            fontWeight: 700,
                            marginBottom: 6,
                          }}
                        >
                          ✅ Historical data found:{" "}
                          {lookupInfo.found.join(", ")}
                        </p>
                        {/* Show stats for first found state */}
                        {autoStats[lookupInfo.found[0]] &&
                          (() => {
                            const s = autoStats[lookupInfo.found[0]];
                            return (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(3,1fr)",
                                  gap: 5,
                                }}
                              >
                                {[
                                  ["Avg Queue", s.avg_count_submitted],
                                  ["Max", s.max_count_submitted],
                                  [
                                    "Trend",
                                    (s.trend_submitted > 0 ? "+" : "") +
                                      s.trend_submitted,
                                  ],
                                  ["Last", s.last_count_submitted],
                                  ["Growth", s.growth_rate + "×"],
                                  ["Months", s.total_months_observed + " mo"],
                                ].map(([l, v]) => (
                                  <div
                                    key={l as string}
                                    style={{
                                      background: "rgba(255,255,255,0.05)",
                                      borderRadius: 6,
                                      padding: "5px 8px",
                                    }}
                                  >
                                    <p style={{ fontSize: 9, color: C.muted }}>
                                      {l}
                                    </p>
                                    <p
                                      style={{
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: C.text,
                                      }}
                                    >
                                      {v}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                      </div>
                    )}
                    {lookupInfo.notFound.length > 0 && (
                      <div
                        style={{
                          padding: "9px 12px",
                          borderRadius: 8,
                          fontSize: 11,
                          background: `${C.amber}10`,
                          border: `1px solid ${C.amber}30`,
                          color: C.amber,
                        }}
                      >
                        ⚠ No data for:{" "}
                        <strong>{lookupInfo.notFound.join(", ")}</strong> —
                        using defaults
                      </div>
                    )}
                    {lookupStatus === "done" &&
                      lookupInfo.found.length === 0 &&
                      lookupInfo.notFound.length === 0 && (
                        <div
                          style={{
                            padding: "9px 12px",
                            borderRadius: 8,
                            fontSize: 11,
                            background: `${C.border}30`,
                            color: C.muted,
                          }}
                        >
                          Select occupation, visa type, and state to auto-load
                          stats
                        </div>
                      )}
                  </div>
                )}
                {lookupStatus === "idle" && (
                  <div
                    style={{
                      padding: "9px 12px",
                      borderRadius: 8,
                      fontSize: 11,
                      background: `${C.border}20`,
                      color: C.muted,
                    }}
                  >
                    Fill in the fields above to auto-load historical EOI stats
                  </div>
                )}
              </div>
            )}

            {/* Manual mode */}
            {mode === "manual" && (
              <div>
                <p style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>
                  Monthly EOI counts (comma-separated, oldest → newest)
                </p>
                <textarea
                  value={manualInput}
                  onChange={(e) => parseManual(e.target.value)}
                  placeholder="e.g. 29, 61, 81, 111, 128, 138, 188, 146, 152, 185"
                  style={{
                    ...inp,
                    minHeight: 68,
                    resize: "vertical",
                    lineHeight: 1.5,
                  }}
                />
                <p style={{ fontSize: 10, color: "#374151", marginTop: 4 }}>
                  Minimum 2 values required
                </p>
                {manualStats && (
                  <div
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      borderRadius: 8,
                      background: `${C.blue}10`,
                      border: `1px solid ${C.blue}30`,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 11,
                        color: C.blue,
                        fontWeight: 700,
                        marginBottom: 8,
                      }}
                    >
                      📊 Computed statistics
                    </p>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3,1fr)",
                        gap: 5,
                      }}
                    >
                      {[
                        ["Average", manualStats.avg_count_submitted],
                        ["Max", manualStats.max_count_submitted],
                        ["Min", manualStats.min_count_submitted],
                        ["Std Dev", manualStats.std_count_submitted],
                        [
                          "Trend",
                          (manualStats.trend_submitted > 0 ? "+" : "") +
                            manualStats.trend_submitted,
                        ],
                        ["Growth", manualStats.growth_rate + "×"],
                      ].map(([l, v]) => (
                        <div
                          key={l as string}
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            borderRadius: 6,
                            padding: "5px 8px",
                          }}
                        >
                          <p style={{ fontSize: 9, color: C.muted }}>{l}</p>
                          <p
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: C.text,
                            }}
                          >
                            {v}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Predict button */}
            <button
              onClick={runPredict}
              disabled={!canPredict || loading}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 8,
                border: "none",
                cursor: !canPredict || loading ? "not-allowed" : "pointer",
                background: !canPredict || loading ? C.border : C.blue,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                marginTop: 16,
              }}
            >
              {loading
                ? `⟳ Predicting ${selStates.length} state${selStates.length > 1 ? "s" : ""}…`
                : canPredict
                  ? `⚡  Predict ${selStates.length} State${selStates.length > 1 ? "s" : ""}`
                  : "Select occupation, visa & state first"}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: `${C.red}12`,
                  border: `1px solid ${C.red}40`,
                }}
              >
                <p style={{ fontSize: 11, color: "#ef4444" }}>{error}</p>
              </div>
            )}
          </Card>

          {/* Model info */}
          <Card>
            <p style={sectionTitle}>Model Info</p>
            {[
              ["Algorithm", "XGBoost (binary:logistic)"],
              ["Features", "32 engineered features"],
              ["Occupations", "386 via LabelEncoder"],
              ["Threshold", `${(threshold * 100).toFixed(0)}%`],
              ["File", "model_xgb.pkl"],
            ].map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  borderBottom: `1px solid ${C.border}20`,
                }}
              >
                <span style={{ fontSize: 11, color: C.muted }}>{k}</span>
                <span style={{ fontSize: 11, color: C.text }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>

        {/* ── RIGHT RESULTS ─────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Placeholder */}
          {results.length === 0 && !loading && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 360,
                background: C.surface,
                borderRadius: 14,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>🎯</p>
                <p style={{ fontSize: 14, color: C.muted }}>
                  Fill in the profile and click Predict
                </p>
                <p style={{ fontSize: 11, color: "#374151", marginTop: 4 }}>
                  Select multiple states to compare them all at once
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {results.length > 0 && (
            <>
              {/* Summary banner */}
              <div
                style={{
                  padding: "16px 22px",
                  borderRadius: 14,
                  background: anyLodgeable ? `${C.green}10` : `${C.red}10`,
                  border: `1px solid ${anyLodgeable ? C.green + "40" : "#ef4444" + "40"}`,
                }}
              >
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: anyLodgeable ? C.green : "#ef4444",
                    marginBottom: 4,
                  }}
                >
                  {anyLodgeable
                    ? "✅ Lodgeable states found"
                    : "❌ No lodgeable states"}
                </p>
                <p style={{ fontSize: 12, color: C.muted }}>
                  {occupation} ·{" "}
                  {VISA_OPTIONS.find((v) => v.value === visaType)
                    ?.label?.split("—")[0]
                    .trim()}{" "}
                  · {points}pts · Threshold: {(threshold * 100).toFixed(0)}%
                </p>
              </div>

              {/* Results list */}
              <Card>
                <p style={{ ...sectionTitle, marginBottom: 14 }}>
                  Results — {results.length} state
                  {results.length > 1 ? "s" : ""} ranked by probability
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {results.map((r, i) => {
                    const prob =
                      typeof r.probability === "number" ? r.probability : 0;
                    const isLodge = prob >= threshold * 100;
                    const col = isLodge ? C.green : "#ef4444";
                    return (
                      <div
                        key={r.state}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "11px 14px",
                          borderRadius: 10,
                          background: C.bg,
                          border: `1px solid ${isLodge ? C.green + "30" : "#ef4444" + "20"}`,
                        }}
                      >
                        {/* Rank */}
                        <span
                          style={{
                            fontSize: 11,
                            color: C.muted,
                            minWidth: 18,
                            fontWeight: 700,
                          }}
                        >
                          #{i + 1}
                        </span>

                        {/* State */}
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            minWidth: 36,
                            color: STATE_COLORS[r.state] || C.muted,
                          }}
                        >
                          {r.state}
                        </span>

                        {/* Prob */}
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 900,
                            color: col,
                            minWidth: 56,
                          }}
                        >
                          {prob.toFixed(1)}%
                        </span>

                        {/* Mini progress bar */}
                        <div
                          style={{
                            flex: 1,
                            height: 7,
                            borderRadius: 99,
                            background: `${C.border}50`,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              borderRadius: 99,
                              width: `${Math.min(prob, 100)}%`,
                              background: col,
                              transition: "width 0.6s ease",
                            }}
                          />
                        </div>

                        {/* Badge */}
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            background: isLodge ? `${C.green}20` : `${C.red}15`,
                            color: isLodge ? C.green : "#ef4444",
                            border: `1px solid ${isLodge ? C.green + "40" : "#ef4444" + "30"}`,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isLodge ? "✅ Lodgeable" : "❌ Not Yet"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>

              {/* Bar chart */}
              <Card>
                <p style={{ ...sectionTitle, marginBottom: 12 }}>
                  Probability Comparison
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={results.map((r) => ({
                      state: r.state,
                      prob:
                        typeof r.probability === "number" ? r.probability : 0,
                    }))}
                    margin={{ top: 4, right: 8, bottom: 0, left: -10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis
                      dataKey="state"
                      tick={{ fill: C.muted, fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fill: C.muted, fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    {/* Threshold reference line */}
                    <Tooltip
                      formatter={(v: any) => [
                        `${Number(v).toFixed(1)}%`,
                        "Probability",
                      ]}
                      contentStyle={{
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        borderRadius: 6,
                        fontSize: 11,
                      }}
                    />
                    <Bar dataKey="prob" radius={[4, 4, 0, 0]}>
                      {results.map((r: any) => (
                        <Cell
                          key={r.state}
                          fill={
                            r.probability >= threshold * 100
                              ? STATE_COLORS[r.state] || C.green
                              : `${C.border}80`
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p
                  style={{
                    fontSize: 10,
                    color: C.muted,
                    marginTop: 6,
                    textAlign: "center",
                  }}
                >
                  Coloured bars = above threshold (
                  {(threshold * 100).toFixed(0)}%) · Grey = below threshold
                </p>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
