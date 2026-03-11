"""
backend/ml/train_eoi_model.py
==============================================
Sprint 4 — Train EOI Skill Select Classifier
==============================================
Maps to notebook: EOI-skill-select-model-classification.ipynb

Model B: Predicts whether an EOI will be INVITED (1) or stay SUBMITTED (0)
Used by:
  - Pathway Predictor  (POST /api/predict/pathway)
  - Approval Scorer    (POST /api/predict/approval)

Run from backend/ folder with venv active:
  python ml/train_eoi_model.py

Output:
  backend/ml/serialized/eoi_model.pkl
  backend/ml/serialized/eoi_encoders.pkl
  backend/ml/serialized/eoi_model_meta.json
"""

import os, sys, json, time
import pandas as pd
import numpy as np
import glob
import joblib
from pathlib import Path

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, roc_auc_score
import xgboost as xgb

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent.parent          # backend/
DATA_PATH  = BASE_DIR / "data" / "raw" / "eoi"              # *.csv files
OUTPUT_DIR = BASE_DIR / "ml" / "serialized"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

print("=" * 60)
print("INTERLACE — EOI Skill Select Model Training")
print("=" * 60)

# ─────────────────────────────────────────────
# 1. LOAD RAW CSV FILES
# ─────────────────────────────────────────────
print("\n[1/6] Loading raw EOI CSV files...")
all_files = list(DATA_PATH.glob("*.csv"))
if not all_files:
    print(f"  ❌ No CSV files found in {DATA_PATH}")
    sys.exit(1)

df_list = []
for f in all_files:
    df_list.append(pd.read_csv(f))
df_raw = pd.concat(df_list, ignore_index=True)
print(f"  ✅ Loaded {len(all_files)} files → {df_raw.shape[0]:,} rows")

# ─────────────────────────────────────────────
# 2. PREPROCESSING (mirrors notebook Cell 3)
# ─────────────────────────────────────────────
print("\n[2/6] Preprocessing...")

df = df_raw.copy()
# Keep only relevant EOI statuses
df = df[df["EOI Status"].isin(["SUBMITTED", "INVITED", "LODGED"])].copy()

# Handle <20 count
df["Count EOIs"] = df["Count EOIs"].astype(str).str.replace("<20", "10")
df["Count EOIs"] = pd.to_numeric(df["Count EOIs"], errors="coerce").fillna(0).astype(int)

# Target: 1 = Invited/Lodged, 0 = Submitted
df["Target"] = np.where(df["EOI Status"].isin(["INVITED", "LODGED"]), 1, 0)

# Expand aggregate rows to individual rows
df_expanded = df.loc[df.index.repeat(df["Count EOIs"])].reset_index(drop=True)

# Time features
df_expanded["As At Month"] = pd.to_datetime(df_expanded["As At Month"], format="%m/%Y")
df_expanded["Month"] = df_expanded["As At Month"].dt.month
df_expanded["Year"]  = df_expanded["As At Month"].dt.year

df_ml = df_expanded.drop(columns=["Count EOIs", "EOI Status", "As At Month"])
print(f"  ✅ Expanded → {df_ml.shape[0]:,} individual rows")
print(f"     Class distribution — 0: {(df_ml['Target']==0).sum():,}  |  1: {(df_ml['Target']==1).sum():,}")

# ─────────────────────────────────────────────
# 3. FEATURE ENGINEERING
# ─────────────────────────────────────────────
print("\n[3/6] Feature engineering...")

# Extract ANZSCO code from Occupation string (first 6 digits)
df_ml["anzsco_code"] = df_ml["Occupation"].str.extract(r"^(\d{6})")[0]

# Encode categoricals
encoders = {}
categorical_cols = ["Visa Type", "Occupation", "Nominated State", "anzsco_code"]

for col in categorical_cols:
    le = LabelEncoder()
    df_ml[col] = le.fit_transform(df_ml[col].astype(str))
    encoders[col] = le

# Feature columns used for prediction
FEATURE_COLS = ["Visa Type", "anzsco_code", "Points", "Nominated State", "Month", "Year"]
X = df_ml[FEATURE_COLS]
y = df_ml["Target"]
print(f"  ✅ Features: {FEATURE_COLS}")

# ─────────────────────────────────────────────
# 4. TRAIN / TEST SPLIT
# ─────────────────────────────────────────────
print("\n[4/6] Splitting data (80/20)...")
# Sample max 5M rows for memory efficiency (XGBoost handles this well)
if len(X) > 5_000_000:
    print(f"  ⚠ Dataset large ({len(X):,} rows), sampling 5M for training...")
    sample_idx = np.random.choice(len(X), 5_000_000, replace=False)
    X = X.iloc[sample_idx]
    y = y.iloc[sample_idx]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"  ✅ Train: {len(X_train):,}  |  Test: {len(X_test):,}")

# ─────────────────────────────────────────────
# 5. TRAIN XGBoost
# ─────────────────────────────────────────────
print("\n[5/6] Training XGBoost classifier...")
t0 = time.time()

# Class imbalance weight
scale_pos = int((y_train == 0).sum() / max((y_train == 1).sum(), 1))

model = xgb.XGBClassifier(
    n_estimators=300,
    max_depth=6,
    learning_rate=0.1,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=scale_pos,
    use_label_encoder=False,
    eval_metric="logloss",
    random_state=42,
    n_jobs=-1,
    tree_method="hist",     # fast for large datasets
)
model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

elapsed = time.time() - t0
print(f"  ✅ Training done in {elapsed:.1f}s")

# ─────────────────────────────────────────────
# 6. EVALUATE & SAVE
# ─────────────────────────────────────────────
print("\n[6/6] Evaluating & saving...")

y_pred  = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

report = classification_report(y_test, y_pred, target_names=["Submitted (0)", "Invited (1)"])
auc    = roc_auc_score(y_test, y_proba)

print("\n── Classification Report ──────────────────────")
print(report)
print(f"  ROC-AUC: {auc:.4f}")

# Save model
model_path    = OUTPUT_DIR / "eoi_model.pkl"
encoders_path = OUTPUT_DIR / "eoi_encoders.pkl"
meta_path     = OUTPUT_DIR / "eoi_model_meta.json"

joblib.dump(model,    model_path)
joblib.dump(encoders, encoders_path)

meta = {
    "model_type":    "XGBClassifier",
    "feature_cols":  FEATURE_COLS,
    "target":        "EOI_invited (0=Submitted, 1=Invited)",
    "roc_auc":       round(auc, 4),
    "train_rows":    len(X_train),
    "test_rows":     len(X_test),
    "scale_pos_weight": scale_pos,
    "trained_at":    pd.Timestamp.now().isoformat(),
}
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)

print(f"\n  ✅ Saved:")
print(f"     {model_path}")
print(f"     {encoders_path}")
print(f"     {meta_path}")
print("\n🎉 EOI model training complete!")
