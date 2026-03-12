import sqlite3, sys, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

candidates = [Path("data/processed/warehouse.db"), Path("../data/processed/warehouse.db")]
db = next((p for p in candidates if p.exists()), None)
if not db:
    print("ERROR: warehouse.db not found"); sys.exit(1)

print("=" * 65)
print(f"warehouse.db  --  {db.stat().st_size/1024/1024:.1f} MB")
print("=" * 65)

conn = sqlite3.connect(db)
tables = {t[0] for t in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}

EXPECTED = {
    "eoi_records": 8000000, "jsa_monthly_ads": 20000,
    "jsa_quarterly_employment": 40000, "jsa_demographics": 4000,
    "jsa_education": 7000, "jsa_shortage": 1000, "jsa_projected": 500,
    "jsa_recruitment": 80, "jsa_top10": 5000, "jsa_mobility": 15000,
    "osl_shortage": 4000, "national_migration_quotas": 40,
    "state_nomination_quotas": 10, "nero_regional": 80000,
    "nero_northern": 40000, "nero_sa4_lookup": 80,
    "nero_sa4": 3000000, "shortage_forecast": 7000,
}

print(f"\n  {'Table':<35} {'Rows':>10}  Status")
print("  " + "-" * 55)
for name, min_rows in sorted(EXPECTED.items()):
    if name not in tables:
        print(f"  {name:<35} {'---':>10}  [MISSING]")
    else:
        n = conn.execute(f"SELECT COUNT(*) FROM [{name}]").fetchone()[0]
        flag = "[OK]" if n >= min_rows else f"[LOW - need {min_rows:,}+]"
        print(f"  {name:<35} {n:>10,}  {flag}")

print("\n--- EOI latest snapshot ---")
r = conn.execute("SELECT as_at_str, COUNT(*), SUM(CASE WHEN count_eois=-1 THEN 10 ELSE count_eois END) FROM eoi_records WHERE eoi_status='SUBMITTED' GROUP BY as_at_str ORDER BY as_at_str DESC LIMIT 1").fetchone()
print(f"  {r[0]}  |  {r[1]:,} records  |  pool {r[2]:,}" if r else "  No data")

print("\n--- OSL latest year ---")
r = conn.execute("SELECT year, COUNT(*), SUM(national) FROM osl_shortage GROUP BY year ORDER BY year DESC LIMIT 1").fetchone()
print(f"  Year {r[0]}  |  {r[1]:,} occupations  |  {r[2]:,} national shortage" if r else "  No data")

print("\n--- Shortage forecast ---")
r = conn.execute("SELECT COUNT(*), COUNT(DISTINCT state), COUNT(DISTINCT anzsco_code) FROM shortage_forecast").fetchone() if "shortage_forecast" in tables else None
print(f"  {r[0]:,} rows  |  {r[1]} states  |  {r[2]:,} codes" if r else "  Table missing")

conn.close()
print("\n" + "=" * 65)