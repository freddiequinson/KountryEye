"""
Migration script to add scan pricing and payment tables.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'kountry_eyecare.db')

def run_migration():
    print(f"Running migration on database: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if scan_pricing exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scan_pricing'")
        if not cursor.fetchone():
            print("Creating scan_pricing table...")
            cursor.execute("""
                CREATE TABLE scan_pricing (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_type VARCHAR(20) UNIQUE NOT NULL,
                    price DECIMAL(10, 2) NOT NULL,
                    description VARCHAR(200),
                    is_active BOOLEAN DEFAULT 1,
                    created_by_id INTEGER REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            """)
            # Insert default prices
            default_prices = [
                ('oct', 150.00, 'Optical Coherence Tomography'),
                ('vft', 100.00, 'Visual Field Test'),
                ('fundus', 80.00, 'Fundus Photography'),
                ('pachymeter', 50.00, 'Pachymeter')
            ]
            for scan_type, price, description in default_prices:
                cursor.execute(
                    "INSERT INTO scan_pricing (scan_type, price, description) VALUES (?, ?, ?)",
                    (scan_type, price, description)
                )
            print("scan_pricing created with default prices")
        else:
            print("scan_pricing already exists")

        # Check if scan_payments exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='scan_payments'")
        if not cursor.fetchone():
            print("Creating scan_payments table...")
            cursor.execute("""
                CREATE TABLE scan_payments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scan_id INTEGER NOT NULL REFERENCES technician_scans(id),
                    amount DECIMAL(10, 2) NOT NULL,
                    is_paid BOOLEAN DEFAULT 0,
                    payment_method VARCHAR(50),
                    payment_date DATETIME,
                    added_to_deficit BOOLEAN DEFAULT 0,
                    deficit_added_at DATETIME,
                    recorded_by_id INTEGER REFERENCES users(id),
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scan_payments_scan ON scan_payments(scan_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_scan_payments_paid ON scan_payments(is_paid)")
            print("scan_payments created")
        else:
            print("scan_payments already exists")

        conn.commit()
        print("Migration completed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
