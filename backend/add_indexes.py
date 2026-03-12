"""
Run once to add indexes to warehouse.db.
Speeds up eoi/occupations, occupation detail, and points queries.

Usage:
  cd backend
  .venv\Scripts\activate
  python add_indexes.py
"""
import sqlite3
import time
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "processed", "warehouse.db")

INDEXES = [
    # Most important — used in every EOI query
    ("idx_eoi_snapshot",   "CREATE INDEX IF NOT EXISTS idx_eoi_snapshot ON eoi_records(as_at_str)"),
    ("idx_eoi_snap_anzsco","CREATE INDEX IF NOT EXISTS idx_eoi_snap_anzsco ON eoi_records(as_at_str, anzsco_code)"),
    ("idx_eoi_snap_state", "CREATE INDEX IF NOT EXISTS idx_eoi_snap_state ON eoi_records(as_at_str, state)"),
    ("idx_eoi_snap_visa",  "CREATE INDEX IF NOT EXISTS idx_eoi_snap_visa ON eoi_records(as_at_str, visa_type)"),
    # Used to find latest snapshot month fast
    ("idx_eoi_year_month", "CREATE INDEX IF NOT EXISTS idx_eoi_year_month ON eoi_records(as_at_year DESC, as_at_month_no DESC)"),
    # Used in occupation detail page
    ("idx_eoi_anzsco",     "CREATE INDEX IF NOT EXISTS idx_eoi_anzsco ON eoi_records(anzsco_code, as_at_str)"),
]

print(f"Connecting to: {DB_PATH}")
conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA journal_mode=WAL")

for name, sql in INDEXES:
    print(f"  Creating {name}...", end=" ", flush=True)
    t = time.time()
    conn.execute(sql)
    conn.commit()
    print(f"done ({time.time()-t:.1f}s)")

conn.close()
print("\n✅ All indexes created. Restart backend to take effect.")