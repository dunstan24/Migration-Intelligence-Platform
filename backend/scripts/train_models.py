"""
scripts/train_models.py  — Pathway Predictor only (model_a.joblib)
Trains the Pathway Predictor using real OSL 2025 shortage data.

Run from backend/:  python scripts/train_models.py

Algorithm: GradientBoostingClassifier
Input:     occupation (ANZSCO), state, points, english_level, age, experience
Output:    ranked (visa subclass + state) pairs with probability scores + SHAP

Australian English Proficiency Levels (Department of Home Affairs):
  "vocational"  — IELTS 5.0  (gates out 189/190)
  "competent"   — IELTS 6.0  (+0 bonus points)
  "proficient"  — IELTS 7.0  (+10 bonus points)
  "superior"    — IELTS 8.0+ (+20 bonus points)

Visa Classes (targets):
  0 = 189 — Skilled Independent
  1 = 190 — State Nominated
  2 = 491 — Skilled Work Regional (Provisional)
"""

import os
import sys
import pandas as pd
import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OrdinalEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.model_selection import cross_val_score
import joblib

# ── Constants ─────────────────────────────────────────────────────────────────
ENGLISH_LEVELS = ["vocational", "competent", "proficient", "superior"]
ENGLISH_POINTS = {
    "vocational": 0,
    "competent":  0,
    "proficient": 10,
    "superior":   20,
}
STATES = ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]
PATHWAY_FEATURES = ["occupation", "state", "points", "english_level", "age", "experience"]
NUM_COLS = ["points", "age", "experience"]
CAT_COLS = ["occupation", "state", "english_level"]


def load_osl_data(backend_root: str) -> pd.DataFrame | None:
    """Load OSL 2025 Cleaned CSV — 917 ANZSCO codes with state shortage flags."""
    path = os.path.join(backend_root, "data", "clean", "osl", "OSL 2025 (ANZSCO 6)_Cleaned.csv")
    if not os.path.exists(path):
        print(f"  WARNING: OSL data not found at {path} — using fallback rules only")
        return None
    df = pd.read_csv(path)
    df["Code"] = df["Code"].astype(str).str.zfill(6)
    return df


def assign_label(anzsco: str, state: str, osl_df: pd.DataFrame | None,
                 points: int, english_level: str) -> int:
    """
    Assign pathway label using real OSL 2025 shortage data + points rules.

    Boundaries (designed for GBM learnability):
      0 = 189 Independent   : nationally listed + adjusted_pts >= 80 + non-vocational
      1 = 190 State Nominated: state-listed OR nationally listed at 65–79 pts
      2 = 491 Regional      : below threshold / vocational english / not listed
    """
    adj = points + ENGLISH_POINTS.get(english_level, 0)
    national = state_sh = 0

    if osl_df is not None:
        row = osl_df[osl_df["Code"] == str(anzsco).zfill(6)]
        if not row.empty:
            national = int(row["National"].values[0])
            state_sh = int(row[state].values[0]) if state in row.columns else 0

    if english_level == "vocational":
        return 2
    if national == 1 and adj >= 80:
        return 0
    if (state_sh == 1 or (national == 1 and adj >= 65)) and adj >= 65:
        return 1
    if adj >= 75 and state not in ["NSW", "VIC"]:
        return 1
    if adj >= 80 and state in ["NSW", "VIC"]:
        return 1
    return 2


def build_dataset(backend_root: str, n: int = 5000) -> pd.DataFrame:
    osl_df = load_osl_data(backend_root)
    codes = osl_df["Code"].tolist() if osl_df is not None else ["261313", "254412"]

    np.random.seed(42)
    pts  = np.clip(np.random.normal(80, 15, n).astype(int), 60, 140)
    eng  = np.random.choice(ENGLISH_LEVELS, n, p=[0.05, 0.30, 0.40, 0.25])
    sts  = np.random.choice(STATES, n)
    occs = [str(c).zfill(6) for c in np.random.choice(codes, n)]

    df = pd.DataFrame({
        "occupation":    occs,
        "state":         sts,
        "points":        pts,
        "english_level": eng,
        "age":           np.clip(np.random.normal(30, 6, n).astype(int), 18, 45),
        "experience":    np.random.choice([1, 2, 3, 5, 8, 10], n,
                                          p=[0.10, 0.15, 0.20, 0.25, 0.20, 0.10]),
    })
    df["target"] = df.apply(
        lambda r: assign_label(r["occupation"], r["state"], osl_df,
                               r["points"], r["english_level"]),
        axis=1,
    )
    return df


def build_pipeline() -> Pipeline:
    numeric_tf = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler",  StandardScaler()),
    ])
    cat_tf = Pipeline([
        ("imputer", SimpleImputer(strategy="constant", fill_value="missing")),
        ("encoder", OrdinalEncoder(
            categories="auto",
            handle_unknown="use_encoded_value",
            unknown_value=-1,
        )),
    ])
    preprocessor = ColumnTransformer([
        ("num", numeric_tf, NUM_COLS),
        ("cat", cat_tf,    CAT_COLS),
    ])
    return Pipeline([
        ("preprocessor", preprocessor),
        ("model", GradientBoostingClassifier(
            n_estimators=200,
            learning_rate=0.08,
            max_depth=4,
            subsample=0.85,
            random_state=42,
        )),
    ])


def train_and_save(backend_root: str):
    print("Building training dataset from OSL 2025 data...")
    df = build_dataset(backend_root)

    dist = df["target"].value_counts().sort_index().to_dict()
    print(f"  Label distribution: 189={dist.get(0, 0)} | 190={dist.get(1, 0)} | 491={dist.get(2, 0)}")

    X = df[PATHWAY_FEATURES]
    y = df["target"]

    print("Training Pathway Predictor (GradientBoostingClassifier)...")
    pipeline = build_pipeline()
    pipeline.fit(X, y)

    cv = cross_val_score(pipeline, X, y, cv=5, scoring="accuracy")
    print(f"  CV Accuracy: {cv.mean():.1%} +/- {cv.std():.1%}")

    out_dir = os.path.join(backend_root, "models")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "model_a.joblib")
    joblib.dump(pipeline, out_path)
    print(f"  Saved -> {os.path.abspath(out_path)}")


if __name__ == "__main__":
    backend_root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    train_and_save(backend_root)
