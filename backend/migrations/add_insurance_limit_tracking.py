"""
Migration to add insurance limit tracking fields to visits table.

When a patient uses insurance, the clinic needs to track:
- insurance_limit: The maximum amount the insurance will cover for this visit
- insurance_used: How much of the limit has been used (consultation + medications + prescriptions)
- patient_topup: Amount the patient needs to pay when insurance limit is exceeded

Run this migration with: python -m migrations.add_insurance_limit_tracking
"""

import sqlite3
import os

def run_migration():
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'kountry_eyecare.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check existing columns
        cursor.execute("PRAGMA table_info(visits)")
        columns = [col[1] for col in cursor.fetchall()]
        
        # Add insurance_limit column if not exists
        if 'insurance_limit' not in columns:
            cursor.execute("ALTER TABLE visits ADD COLUMN insurance_limit DECIMAL(10, 2) DEFAULT 0")
            print("Added insurance_limit column to visits table")
        else:
            print("insurance_limit column already exists")
        
        # Add insurance_used column if not exists
        if 'insurance_used' not in columns:
            cursor.execute("ALTER TABLE visits ADD COLUMN insurance_used DECIMAL(10, 2) DEFAULT 0")
            print("Added insurance_used column to visits table")
        else:
            print("insurance_used column already exists")
        
        # Add patient_topup column if not exists (amount patient pays when insurance exceeded)
        if 'patient_topup' not in columns:
            cursor.execute("ALTER TABLE visits ADD COLUMN patient_topup DECIMAL(10, 2) DEFAULT 0")
            print("Added patient_topup column to visits table")
        else:
            print("patient_topup column already exists")
        
        conn.commit()
        print("Migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    run_migration()
