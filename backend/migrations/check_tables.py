import sqlite3
conn = sqlite3.connect('kountry_eyecare.db')
cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
print([row[0] for row in cursor.fetchall()])
conn.close()
