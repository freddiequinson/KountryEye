import sqlite3

conn = sqlite3.connect('backend/data/kountry_eyecare.db')
cursor = conn.cursor()

# Check existing tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [row[0] for row in cursor.fetchall()]
print("Tables:", tables)

# Check if messages table exists and its columns
if 'messages' in tables:
    cursor.execute("PRAGMA table_info(messages)")
    columns = [row[1] for row in cursor.fetchall()]
    print("Messages columns:", columns)
    
    if 'reply_to_id' not in columns:
        print("Adding reply_to_id column...")
        cursor.execute("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id)")
        conn.commit()
        print("Column added successfully!")
    else:
        print("reply_to_id column already exists")
else:
    print("Messages table not found")

conn.close()
