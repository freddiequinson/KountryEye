#!/usr/bin/env python3
import sqlite3
import os

db_path = '/var/www/kountryeye/backend/kountry_eyecare.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Get existing columns in messages table
cursor.execute("PRAGMA table_info(messages)")
existing_columns = [col[1] for col in cursor.fetchall()]
print(f"Existing columns in messages: {existing_columns}")

# Add reply_to_id if not exists
if 'reply_to_id' not in existing_columns:
    cursor.execute("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER")
    print("Added reply_to_id column to messages")
else:
    print("reply_to_id column already exists")

# Create message_read_receipts table if not exists
cursor.execute("""
    CREATE TABLE IF NOT EXISTS message_read_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        delivered_at DATETIME,
        read_at DATETIME,
        FOREIGN KEY (message_id) REFERENCES messages(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )
""")
print("Created/verified message_read_receipts table")

conn.commit()
conn.close()
print("Migration completed successfully")
