"""Add checkout_time column to visits table"""
import sqlite3
import os

def run_migration():
    # Get the database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'kountry_eyecare.db')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if column exists
    cursor.execute("PRAGMA table_info(visits)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'checkout_time' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN checkout_time TIMESTAMP NULL")
        conn.commit()
        print("Added checkout_time column to visits table")
    else:
        print("checkout_time column already exists")
    
    conn.close()

if __name__ == "__main__":
    run_migration()
    print("Migration completed successfully!")
