"""
backend/pipelines/ingestors/volume_forecast_ingestor.py
========================================================
Ingests final_migration_forecast_2030.csv into warehouse.db
Table: migration_volume_forecast

CSV columns:
  ds              - date string e.g. "1/1/2026"
  yhat            - Prophet point forecast
  yhat_lower_95   - 95% confidence interval lower
  yhat_upper_95   - 95% confidence interval upper
  yhat_lower_80   - 80% confidence interval lower
  yhat_upper_80   - 80% confidence interval upper

Run from backend/ folder with venv active:
  python pipelines/ingestors/volume_forecast_ingestor.py
"""

import sys, io, sqlite3
from pathlib import Path
import pandas as pd

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# ── Locate warehouse.db ──────────────────────────────────────────
def find_db() -> Path:
    candidates = [
        Path("data/processed/warehouse.db"),
        Path("../data/processed/warehouse.db"),
    ]
    for p in candidates:
        if p.exists():
            return p
    # Walk up
    here = Path(__file__).resolve()
    for parent in here.parents:
        candidate = parent / "data" / "processed" / "warehouse.db"
        if candidate.exists():
            return candidate
    raise FileNotFoundError("warehouse.db not found")

# ── Locate CSV ───────────────────────────────────────────────────
def find_csv() -> Path:
    names = [
        "final_migration_forecast_2030.csv",
        "migration_forecast_2030.csv",
        "migration_volume_forecast.csv",
    ]
    search_dirs = [
        Path("data/raw/volume_forecast"),
        Path("../data/raw/volume_forecast"),
        Path("data/raw"),
        Path("../data/raw"),
    ]
    for d in search_dirs:
        for name in names:
            p = d / name
            if p.exists():
                return p
    raise FileNotFoundError(
        "CSV not found. Place final_migration_forecast_2030.csv in:\n"
        "  backend/data/raw/volume_forecast/"
    )

print("=" * 55)
print("INTERLACE -- Migration Volume Forecast Ingestor")
print("=" * 55)

db_path  = find_db()
csv_path = find_csv()
print(f"DB  : {db_path}")
print(f"CSV : {csv_path}")

# ── Read CSV ─────────────────────────────────────────────────────
df = pd.read_csv(csv_path)
print(f"\nRows loaded: {len(df)}")

# Parse date  "1/1/2026" → "2026-01-01"
df["month"] = pd.to_datetime(df["ds"], dayfirst=True).dt.strftime("%Y-%m-%d")
df["year"]  = pd.to_datetime(df["ds"], dayfirst=True).dt.year
df["month_no"] = pd.to_datetime(df["ds"], dayfirst=True).dt.month

# Round all forecast values to 2dp
for col in ["yhat","yhat_lower_95","yhat_upper_95","yhat_lower_80","yhat_upper_80"]:
    df[col] = df[col].round(2)

# ── Write to SQLite ──────────────────────────────────────────────
conn = sqlite3.connect(db_path)

conn.execute("DROP TABLE IF EXISTS migration_volume_forecast")
conn.execute("""
CREATE TABLE migration_volume_forecast (
    month           TEXT PRIMARY KEY,   -- "2026-01-01"
    year            INTEGER,
    month_no        INTEGER,
    yhat            REAL,               -- point forecast
    yhat_lower_95   REAL,
    yhat_upper_95   REAL,
    yhat_lower_80   REAL,
    yhat_upper_80   REAL
)
""")

rows = [
    (
        row["month"], int(row["year"]), int(row["month_no"]),
        row["yhat"], row["yhat_lower_95"], row["yhat_upper_95"],
        row["yhat_lower_80"], row["yhat_upper_80"],
    )
    for _, row in df.iterrows()
]

conn.executemany("""
INSERT OR REPLACE INTO migration_volume_forecast
    (month, year, month_no, yhat, yhat_lower_95, yhat_upper_95, yhat_lower_80, yhat_upper_80)
VALUES (?,?,?,?,?,?,?,?)
""", rows)

conn.commit()

# Verify
count = conn.execute("SELECT COUNT(*) FROM migration_volume_forecast").fetchone()[0]
first = conn.execute("SELECT month, yhat FROM migration_volume_forecast ORDER BY month LIMIT 1").fetchone()
last  = conn.execute("SELECT month, yhat FROM migration_volume_forecast ORDER BY month DESC LIMIT 1").fetchone()
conn.close()

print(f"\n[OK] migration_volume_forecast: {count} rows")
print(f"     Range: {first[0]} ({first[1]:,.0f}) -> {last[0]} ({last[1]:,.0f})")
print("\nDone! Restart backend to expose the new endpoint.")