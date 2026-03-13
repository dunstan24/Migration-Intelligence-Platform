import sqlite3

db_path = r"d:\Interlace_DataAnalyst\Migration-Intelligence-Platform\backend\data\processed\warehouse.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables = ["eoi_records", "osl_shortage", "state_nomination_quotas", "shortage_forecast"]

for table in tables:
    print(f"\n--- {table} ---")
    try:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        for col in columns:
            print(f"  {col[1]} ({col[2]})")
    except Exception as e:
        print(f"  Error: {e}")

conn.close()
