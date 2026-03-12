# -*- coding: utf-8 -*-
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

"""
backend/pipelines/ingestors/shortage_forecast_ingestor.py
==========================================================
Ingests Occupation_Shortage_Forecaster_2026_2030_Wide.csv
→ warehouse.db table: shortage_forecast

SETUP:
  1. Copy CSV to:  backend/data/raw/shortage_forecast/Occupation_Shortage_Forecaster_2026_2030_Wide.csv
  2. Run from backend/ folder with venv active:
       python pipelines/ingestors/shortage_forecast_ingestor.py
"""

import sys
import sqlite3
import pandas as pd
from pathlib import Path

# File is at backend/pipelines/ingestors/ → parent.parent = backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent   # backend/
# Safety: walk up until we find data/processed/warehouse.db
for _candidate in [BASE_DIR, BASE_DIR.parent, BASE_DIR.parent.parent]:
    if (_candidate / "data" / "processed" / "warehouse.db").exists():
        BASE_DIR = _candidate
        break

CSV_PATH = BASE_DIR / "data" / "raw" / "shortage_forecast" / "Occupation_Shortage_Forecaster_2026_2030_Wide.csv"
DB_PATH  = BASE_DIR / "data" / "processed" / "warehouse.db"
print(f"  BASE_DIR : {BASE_DIR}")
print(f"  DB_PATH  : {DB_PATH}")
print(f"  CSV_PATH : {CSV_PATH}")

print("=" * 60)
print("INTERLACE — Shortage Forecast Ingestor")
print("=" * 60)

if not CSV_PATH.exists():
    print(f"\n[ERROR]  CSV not found: {CSV_PATH}")
    print("    Create the folder and copy the CSV there, then re-run.")
    sys.exit(1)

if not DB_PATH.exists():
    print(f"\n[ERROR]  warehouse.db not found: {DB_PATH}")
    sys.exit(1)

# ── Load & normalise ─────────────────────────────────────────────
print(f"\n[1/3] Loading {CSV_PATH.name} ...")
df = pd.read_csv(CSV_PATH)
print(f"  Rows raw: {len(df):,}  |  Cols: {df.columns.tolist()}")

df["Code"]  = df["Code"].astype(str).str.strip().str.zfill(6)
df["State"] = df["State"].str.strip().str.upper()

df = df.rename(columns={
    "Code":       "anzsco_code",
    "Occupation": "occupation",
    "State":      "state",
    "Prob_2026":  "prob_2026",
    "Prob_2027":  "prob_2027",
    "Prob_2028":  "prob_2028",
    "Prob_2029":  "prob_2029",
    "Prob_2030":  "prob_2030",
})[["anzsco_code", "occupation", "state",
    "prob_2026", "prob_2027", "prob_2028", "prob_2029", "prob_2030"]]

print(f"  States: {sorted(df['state'].unique().tolist())}")
print(f"  Unique ANZSCO codes: {df['anzsco_code'].nunique():,}")

# ── Write to DB ──────────────────────────────────────────────────
print(f"\n[2/3] Writing to warehouse.db ...")
conn = sqlite3.connect(DB_PATH)
cur  = conn.cursor()

cur.execute("DROP TABLE IF EXISTS shortage_forecast")
cur.execute("""
    CREATE TABLE shortage_forecast (
        anzsco_code TEXT NOT NULL,
        occupation  TEXT NOT NULL,
        state       TEXT NOT NULL,
        prob_2026   REAL,
        prob_2027   REAL,
        prob_2028   REAL,
        prob_2029   REAL,
        prob_2030   REAL,
        PRIMARY KEY (anzsco_code, state)
    )
""")

rows = df.to_dict(orient="records")
BATCH = 500
for i in range(0, len(rows), BATCH):
    cur.executemany("""
        INSERT OR REPLACE INTO shortage_forecast
          (anzsco_code, occupation, state,
           prob_2026, prob_2027, prob_2028, prob_2029, prob_2030)
        VALUES
          (:anzsco_code, :occupation, :state,
           :prob_2026, :prob_2027, :prob_2028, :prob_2029, :prob_2030)
    """, rows[i:i+BATCH])
    print(f"  {min(i+BATCH, len(rows)):,}/{len(rows):,}", end="\r")

conn.commit()

# Indexes for fast API queries
cur.execute("CREATE INDEX IF NOT EXISTS idx_sf_code  ON shortage_forecast(anzsco_code)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_sf_state ON shortage_forecast(state)")
cur.execute("CREATE INDEX IF NOT EXISTS idx_sf_2026  ON shortage_forecast(state, prob_2026 DESC)")
conn.commit()

# ── Verify ───────────────────────────────────────────────────────
count = cur.execute("SELECT COUNT(*) FROM shortage_forecast").fetchone()[0]
sample = cur.execute(
    "SELECT anzsco_code, occupation, state, prob_2026 FROM shortage_forecast LIMIT 3"
).fetchall()
conn.close()

print(f"\n[3/3] Verification")
print(f"  [OK]  shortage_forecast rows: {count:,}")
for s in sample:
    print(f"      {s[0]} | {s[1][:30]:30s} | {s[2]} | {s[3]:.3f}")
print("\n[DONE]  Done! Restart uvicorn — endpoint /api/data/shortage-forecast is live.")