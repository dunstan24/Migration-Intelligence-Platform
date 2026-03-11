"use client";
/**
 * Predictors — Coming Soon (Sprint 4)
 * ML models not yet trained. This page will be implemented in Sprint 4.
 */
import { C, Card, PageWrapper } from "@/components/ui";

const MODELS = [
  {
    id: "A",
    label: "Pathway Predictor",
    algo: "GradientBoostingClassifier",
    desc: "Ranks visa pathways (189/190/491) and states by likelihood of success based on occupation, points, English level, age, and experience.",
    output: "Ranked list of visa + state combinations with probability scores",
    color: C.blue,
  },
  {
    id: "B",
    label: "Shortage Forecaster",
    algo: "RandomForestClassifier",
    desc: "Predicts whether an occupation will be on the shortage list in 2026–2030 based on JSA ratings, EOI trends, and employment growth.",
    output: "Shortage probability per year 2026–2030 with confidence interval",
    color: C.green,
  },
  {
    id: "C",
    label: "Volume Forecaster",
    algo: "Prophet (Meta)",
    desc: "Time-series model forecasting monthly invitation volumes to December 2030, accounting for seasonality and policy changes.",
    output: "Monthly invitation forecast with upper/lower bounds",
    color: C.purple,
  },
  {
    id: "D",
    label: "Approval Scorer",
    algo: "LogisticRegression",
    desc: "Estimates visa approval probability based on points score, English band, skills assessment status, and country risk tier.",
    output: "Approval probability + risk flag list + recommendation",
    color: C.amber,
  },
];

const FEATURES = [
  {
    label: "Training data",
    value: "occupation_features table — ANZSCO × state features",
  },
  { label: "Feature count", value: "~12 features per occupation/state pair" },
  {
    label: "Training set",
    value: "EOI 2024–2026 + OSL 2021–2025 + JSA Labour Atlas",
  },
  {
    label: "Serialization",
    value: "joblib — models saved to backend/ml/serialized/",
  },
  {
    label: "Explainability",
    value: "SHAP values per prediction (feature importance)",
  },
  { label: "API endpoint", value: "POST /api/predict/{model_name}" },
];

export default function Predictors() {
  return (
    <PageWrapper
      title="ML Predictors"
      sub="Sprint 4 — Models not yet trained · Coming soon"
    >
      {/* Banner */}
      <div
        style={{
          background: `${C.amber}12`,
          border: `1px solid ${C.amber}40`,
          borderRadius: 12,
          padding: "20px 24px",
          marginBottom: 28,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ fontSize: 32 }}>🔬</div>
        <div>
          <p
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: C.amber,
              marginBottom: 4,
            }}
          >
            ML Models Not Yet Trained — Sprint 4 Required
          </p>
          <p style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
            The model architecture, API endpoints, and frontend UI are designed
            and ready. Sprint 4 will train all 4 models on the warehouse data
            and connect them here. Until then, the endpoints return placeholder
            responses only.
          </p>
        </div>
      </div>

      {/* Model cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {MODELS.map((m) => (
          <Card key={m.id} style={{ borderLeft: `3px solid ${m.color}` }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: m.color,
                      background: `${m.color}18`,
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: `1px solid ${m.color}35`,
                    }}
                  >
                    Model {m.id}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: C.muted,
                      fontFamily: "monospace",
                    }}
                  >
                    {m.algo}
                  </span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.text }}>
                  {m.label}
                </p>
              </div>
              <span
                style={{
                  fontSize: 10,
                  color: C.muted,
                  background: `${C.muted}15`,
                  padding: "3px 8px",
                  borderRadius: 4,
                  border: `1px solid ${C.border}`,
                }}
              >
                Pending Sprint 4
              </span>
            </div>
            <p
              style={{
                fontSize: 12,
                color: C.muted,
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              {m.desc}
            </p>
            <div
              style={{
                background: C.bg,
                borderRadius: 6,
                padding: "8px 12px",
                border: `1px solid ${C.border}`,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: C.muted,
                  marginBottom: 2,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                Output
              </p>
              <p style={{ fontSize: 11, color: m.color }}>{m.output}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Implementation details */}
      <Card>
        <p
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: C.text,
            marginBottom: 16,
          }}
        >
          Sprint 4 Implementation Details
        </p>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
          {FEATURES.map((f) => (
            <div
              key={f.label}
              style={{
                display: "flex",
                gap: 12,
                padding: "10px 0",
                borderBottom: `1px solid ${C.border}22`,
              }}
            >
              <span style={{ fontSize: 11, color: C.muted, minWidth: 140 }}>
                {f.label}
              </span>
              <span
                style={{ fontSize: 11, color: C.text, fontFamily: "monospace" }}
              >
                {f.value}
              </span>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: `${C.blue}10`,
            border: `1px solid ${C.blue}30`,
            borderRadius: 8,
          }}
        >
          <p
            style={{
              fontSize: 12,
              color: C.blue,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            To implement Sprint 4:
          </p>
          <p style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>
            1. Uncomment scikit-learn, xgboost, prophet, shap, joblib in
            requirements.txt
            <br />
            2. Build feature matrix from warehouse.db → occupation_features
            table
            <br />
            3. Train all 4 models → save to backend/ml/serialized/
            <br />
            4. Replace mock logic in routers/predict.py with real
            model.predict_proba()
            <br />
            5. Re-enable this page with the full prediction UI
          </p>
        </div>
      </Card>
    </PageWrapper>
  );
}
