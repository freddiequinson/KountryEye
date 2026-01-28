import sqlite3
conn = sqlite3.connect('kountry_eyecare.db')
cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]
print("Tables:", tables)

# Check for prescription-related tables
for t in tables:
    if 'presc' in t.lower():
        print(f"\nTable: {t}")
        cursor = conn.execute(f"PRAGMA table_info({t})")
        for col in cursor.fetchall():
            print(f"  {col[1]} ({col[2]})")
