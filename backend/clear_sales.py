import sqlite3

conn = sqlite3.connect('kountry_eyecare.db')
cursor = conn.cursor()

# List tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]
print("Tables:", tables)

# Find sale-related tables
for table in tables:
    if 'sale' in table.lower():
        print(f"Found sale table: {table}")
        cursor.execute(f"DELETE FROM {table}")
        print(f"Cleared {table}")

conn.commit()
print("Sales cleared successfully")
conn.close()
