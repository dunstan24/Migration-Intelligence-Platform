"""
backend/ml/train_shortage_model.py
==============================================
Sprint 4 — Train Occupation Shortage Forecaster
==============================================
Maps to notebook: forecasting-shortage-model.ipynb

Model B: RandomForest + CalibratedClassifierCV
Predicts shortage probability per occupation per state for 2026–2030

Run from backend/ folder with venv active:
  python ml/train_shortage_model.py

Output:
  backend/ml/serialized/shortage_model.pkl
  backend/ml/serialized/shortage_forecast.json   ← pre-computed 2026–2030 forecasts
  backend/ml/serialized/shortage_model_meta.json
"""

import os, sys, json, time
import pandas as pd
import numpy as np
import joblib
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, brier_score_loss, roc_auc_score

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "ml" / "serialized"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HISTORICAL_YEARS = [2021, 2022, 2023, 2024, 2025]
FORECAST_YEARS   = [2026, 2027, 2028, 2029, 2030]
STATES           = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "NT", "ACT"]

JSA_MAP = {"S": 1.0, "R": 0.5, "NS": 0.0}
FEATURES = ["shortage_streak", "shortage_count_5yr", "employment_growth", "jsa_rating", "eoi_activity"]

print("=" * 60)
print("INTERLACE — Occupation Shortage Forecaster Training")
print("=" * 60)

# ─────────────────────────────────────────────
# HELPER: load from warehouse.db via SQLite
# ─────────────────────────────────────────────
import sqlite3

def load_from_db():
    db_path = BASE_DIR / "data" / "processed" / "warehouse.db"
    if not db_path.exists():
        print(f"  ❌ warehouse.db not found at {db_path}")
        sys.exit(1)
    conn = sqlite3.connect(db_path)
    return conn

# ─────────────────────────────────────────────
# 1. LOAD OSL HISTORICAL DATA
# ─────────────────────────────────────────────
print("\n[1/7] Loading OSL historical data from warehouse.db...")
conn = load_from_db()

osl_df = pd.read_sql("""
    SELECT anzsco_code AS Code, occupation AS Occupation, state AS State,
           is_shortage, year AS Year
    FROM osl_shortage
    WHERE year BETWEEN 2021 AND 2025
    ORDER BY Code, State, Year
""", conn)

osl_df["Code"] = osl_df["Code"].astype(str).str.strip()
print(f"  ✅ OSL rows: {len(osl_df):,}")

# ─────────────────────────────────────────────
# 2. LOAD JSA DATA
# ─────────────────────────────────────────────
print("\n[2/7] Loading JSA data from warehouse.db...")

jsa_raw = pd.read_sql("""
    SELECT anzsco_code AS Code,
           jsa_rating_aus AS JSA_Rating_AUS,
           jsa_rating_nsw AS JSA_Rating_NSW,
           jsa_rating_vic AS JSA_Rating_VIC,
           jsa_rating_qld AS JSA_Rating_QLD,
           jsa_rating_sa  AS JSA_Rating_SA,
           jsa_rating_wa  AS JSA_Rating_WA,
           jsa_rating_tas AS JSA_Rating_TAS,
           jsa_rating_nt  AS JSA_Rating_NT,
           jsa_rating_act AS JSA_Rating_ACT,
           future_demand  AS Future_Demand
    FROM jsa_shortage
    LIMIT 5000
""", conn)
jsa_raw["Code"] = jsa_raw["Code"].astype(str).str.strip()
print(f"  ✅ JSA rows: {len(jsa_raw):,}")

# ─────────────────────────────────────────────
# 3. LOAD EMPLOYMENT PROJECTIONS
# ─────────────────────────────────────────────
print("\n[3/7] Loading employment projections from warehouse.db...")

try:
    proj_df = pd.read_sql("""
        SELECT anzsco_code AS ANZSCO_Code, pct_5y_change AS Pct_5Y_Change
        FROM employment_projections
    """, conn)
    proj_df["ANZSCO_Code"] = proj_df["ANZSCO_Code"].astype(str).str.strip()
    print(f"  ✅ Projection rows: {len(proj_df):,}")
except Exception as e:
    print(f"  ⚠ Could not load projections ({e}), using zeros")
    proj_df = pd.DataFrame(columns=["ANZSCO_Code", "Pct_5Y_Change"])

# ─────────────────────────────────────────────
# 4. LOAD EOI ACTIVITY
# ─────────────────────────────────────────────
print("\n[4/7] Loading EOI activity from warehouse.db...")

# Use latest snapshot month per state, aggregate by ANZSCO4 → state
eoi_agg = pd.read_sql("""
    SELECT
        SUBSTR(anzsco_code, 1, 6) AS Code,
        state                     AS State,
        SUM(CASE WHEN count_eois = -1 THEN 10 ELSE count_eois END) AS Count
    FROM eoi_records
    WHERE eoi_status = 'SUBMITTED'
    AND as_at_str = (SELECT as_at_str FROM eoi_records
                     ORDER BY as_at_year DESC, as_at_month_no DESC LIMIT 1)
    GROUP BY Code, State
""", conn)
eoi_agg["Code"] = eoi_agg["Code"].astype(str).str.strip()
conn.close()
print(f"  ✅ EOI activity rows: {len(eoi_agg):,}")

# ─────────────────────────────────────────────
# 5. FEATURE ENGINEERING (mirrors notebook Cell 5)
# ─────────────────────────────────────────────
print("\n[5/7] Engineering features...")

feature_map = {}
occ_names   = osl_df.set_index("Code")["Occupation"].to_dict()

for code_str in osl_df["Code"].unique():
    code_4 = code_str[:4]
    for state in STATES:
        # A. JSA rating
        jsa_val = 0.0
        jsa_row = jsa_raw[jsa_raw["Code"] == code_str]
        if not jsa_row.empty:
            col = f"JSA_Rating_{state}"
            if col in jsa_row.columns:
                jsa_val = JSA_MAP.get(str(jsa_row[col].iloc[0]).strip(), 0.0)

        # B. Employment growth (6-digit then 4-digit fallback)
        growth_val = 0.0
        pr = proj_df[proj_df["ANZSCO_Code"] == code_str]
        if pr.empty:
            pr = proj_df[proj_df["ANZSCO_Code"] == code_4]
        if not pr.empty:
            growth_val = float(pr["Pct_5Y_Change"].iloc[0])

        # C. EOI activity
        eoi_val = 0.0
        er = eoi_agg[(eoi_agg["Code"] == code_str) & (eoi_agg["State"] == state)]
        if not er.empty:
            eoi_val = float(er["Count"].iloc[0])

        feature_map[(code_str, state)] = (jsa_val, growth_val, eoi_val)

# Build training data
train_data = []
for (code, state), group in osl_df.groupby(["Code", "State"]):
    shortages = group.sort_values("Year")["is_shortage"].values
    for i in range(1, len(shortages)):
        hist   = shortages[:i]
        streak = sum(1 for v in reversed(hist) if v == 1)   # consecutive from end
        # break streak at first 0
        for idx, v in enumerate(reversed(hist)):
            if v == 0:
                streak = idx
                break
        count_5yr = int(sum(hist[-5:]))
        jsa_v, growth_v, eoi_v = feature_map.get((code, state), (0.0, 0.0, 0.0))
        train_data.append({
            "shortage_streak":    streak,
            "shortage_count_5yr": count_5yr,
            "employment_growth":  growth_v,
            "jsa_rating":         jsa_v,
            "eoi_activity":       eoi_v,
            "target":             int(shortages[i]),
        })

df_train = pd.DataFrame(train_data)
print(f"  ✅ Training rows: {len(df_train):,}")
print(f"     Class distribution — 0: {(df_train['target']==0).sum():,}  |  1: {(df_train['target']==1).sum():,}")

# ─────────────────────────────────────────────
# 6. TRAIN + CALIBRATE MODEL (mirrors notebook Cell 6)
# ─────────────────────────────────────────────
print("\n[6/7] Training RandomForest + Calibration...")
t0 = time.time()

X = df_train[FEATURES]
y = df_train["target"]

X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

rf_base = RandomForestClassifier(
    n_estimators=150, max_depth=10, random_state=42, n_jobs=-1
)
model = CalibratedClassifierCV(rf_base, method="sigmoid", cv=5)
model.fit(X_train, y_train)

y_pred  = model.predict(X_val)
y_proba = model.predict_proba(X_val)[:, 1]

brier = brier_score_loss(y_val, y_proba)
auc   = roc_auc_score(y_val, y_proba)

print(f"\n── Evaluation ─────────────────────────────────")
print(classification_report(y_val, y_pred, target_names=["No Shortage (0)", "Shortage (1)"]))
print(f"  Brier Score: {brier:.4f}   ROC-AUC: {auc:.4f}")
print(f"  Training time: {time.time()-t0:.1f}s")

# Retrain on 100% data
print("\n  Retraining on full dataset...")
model.fit(X, y)

# ─────────────────────────────────────────────
# 7. PRE-COMPUTE 2026–2030 FORECASTS (mirrors notebook Cell 7)
# ─────────────────────────────────────────────
print("\n[7/7] Pre-computing 2026–2030 forecasts...")

current_histories = (
    osl_df.groupby(["Code", "State"])["is_shortage"]
    .apply(list)
    .to_dict()
)

forecast_records = []

for forecast_year in FORECAST_YEARS:
    year_gap    = forecast_year - 2026
    batch_feats = []
    keys        = []

    for (code, state), history in current_histories.items():
        streak = 0
        for v in reversed(history):
            if v == 1:
                streak += 1
            else:
                break
        count_5yr = int(sum(history[-5:]))
        jsa_v, growth_v, eoi_v = feature_map.get((code, state), (0.0, 0.0, 0.0))

        # Market dynamics simulation
        sim_eoi    = eoi_v    * (0.85 ** year_gap)
        sim_growth = growth_v * (0.95 ** year_gap)

        batch_feats.append([streak, count_5yr, sim_growth, jsa_v, sim_eoi])
        keys.append((code, state))

    df_batch = pd.DataFrame(batch_feats, columns=FEATURES)
    probs    = model.predict_proba(df_batch)[:, 1]

    for i, (code, state) in enumerate(keys):
        p = float(probs[i])
        forecast_records.append({
            "code":       code,
            "occupation": occ_names.get(code, "Unknown"),
            "state":      state,
            "year":       forecast_year,
            "prob":       round(p, 4),
        })
        current_histories[(code, state)].append(1 if p > 0.45 else 0)

# Convert to wide format for fast API lookup
df_fc = pd.DataFrame(forecast_records)
df_wide = df_fc.pivot_table(
    index=["code", "occupation", "state"],
    columns="year",
    values="prob",
).reset_index()
df_wide.columns.name = None
df_wide = df_wide.rename(columns={y: f"prob_{y}" for y in FORECAST_YEARS})
df_wide = df_wide.sort_values(["state", "prob_2026"], ascending=[True, False])
df_wide["anzsco4"] = df_wide["code"].str[:4]

# Save as JSON dict: {anzsco_code: {state: {year: prob}}}
forecast_dict = {}
for _, row in df_wide.iterrows():
    c = row["code"]
    s = row["state"]
    if c not in forecast_dict:
        forecast_dict[c] = {}
    forecast_dict[c][s] = {
        str(y): round(row.get(f"prob_{y}", 0.0), 4) for y in FORECAST_YEARS
    }

# Also build top-shortages index: {state: [{code, occ, prob_2026, ...}, ...]}
top_shortage = {}
for state in STATES:
    rows = df_wide[df_wide["state"] == state].copy()
    top_shortage[state] = rows.nlargest(50, "prob_2026")[[
        "code", "occupation", "anzsco4",
        "prob_2026", "prob_2027", "prob_2028", "prob_2029", "prob_2030"
    ]].to_dict(orient="records")

forecast_payload = {
    "by_code":     forecast_dict,
    "top_shortage": top_shortage,
    "generated_at": pd.Timestamp.now().isoformat(),
    "model_meta":   {"roc_auc": round(auc, 4), "brier": round(brier, 4)},
}

# ─────────────────────────────────────────────
# SAVE ARTIFACTS
# ─────────────────────────────────────────────
model_path    = OUTPUT_DIR / "shortage_model.pkl"
forecast_path = OUTPUT_DIR / "shortage_forecast.json"
meta_path     = OUTPUT_DIR / "shortage_model_meta.json"

joblib.dump(model, model_path)

with open(forecast_path, "w") as f:
    json.dump(forecast_payload, f)

meta = {
    "model_type":  "RandomForest+CalibratedClassifierCV",
    "features":    FEATURES,
    "roc_auc":     round(auc, 4),
    "brier_score": round(brier, 4),
    "train_rows":  len(X_train),
    "forecast_years": FORECAST_YEARS,
    "states":         STATES,
    "trained_at":  pd.Timestamp.now().isoformat(),
}
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)

print(f"\n  ✅ Saved:")
print(f"     {model_path}")
print(f"     {forecast_path}")
print(f"     {meta_path}")
print(f"\n  Total forecast records: {len(forecast_records):,}")
print("\n🎉 Shortage forecaster training complete!")
