"""
Migration script to add payment_type and insurance fields to visits table.
Run this script once to update the database schema.
"""
import sqlite3
import os

# Get the database path
db_path = os.path.join(os.path.dirname(__file__), 'data', 'kountry_eyecare.db')

def migrate():
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if columns already exist
    cursor.execute("PRAGMA table_info(visits)")
    columns = [col[1] for col in cursor.fetchall()]
    
    migrations = []
    
    if 'payment_type' not in columns:
        migrations.append("ALTER TABLE visits ADD COLUMN payment_type VARCHAR(20) DEFAULT 'cash'")
    
    if 'insurance_provider' not in columns:
        migrations.append("ALTER TABLE visits ADD COLUMN insurance_provider VARCHAR(100)")
    
    if 'insurance_id' not in columns:
        migrations.append("ALTER TABLE visits ADD COLUMN insurance_id VARCHAR(50)")
    
    if 'insurance_number' not in columns:
        migrations.append("ALTER TABLE visits ADD COLUMN insurance_number VARCHAR(50)")
    
    if 'insurance_coverage' not in columns:
        migrations.append("ALTER TABLE visits ADD COLUMN insurance_coverage DECIMAL(10,2) DEFAULT 0")
    
    if 'visioncare_member_id' not in columns:
        migrations.append("ALTER TABLE visits ADD COLUMN visioncare_member_id VARCHAR(50)")
    
    if not migrations:
        print("All columns already exist. No migration needed.")
        conn.close()
        return
    
    print(f"Running {len(migrations)} migrations...")
    for sql in migrations:
        print(f"  Executing: {sql}")
        cursor.execute(sql)
    
    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
