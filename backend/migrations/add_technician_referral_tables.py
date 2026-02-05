"""
Migration script to add technician referral system tables.
Run this script to create the new tables for:
- referral_doctors
- external_referrals
- technician_scans
- referral_payment_settings
- referral_payments

Usage:
    python -m migrations.add_technician_referral_tables
"""

import sqlite3
import os
from datetime import datetime

# Determine database path
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'kountry_eyecare.db')

def run_migration():
    print(f"Running migration on database: {DB_PATH}")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        # Check if tables already exist
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='referral_doctors'")
        if cursor.fetchone():
            print("Tables already exist. Skipping migration.")
            return
        
        print("Creating referral_doctors table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS referral_doctors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                phone VARCHAR(20) UNIQUE NOT NULL,
                email VARCHAR(255),
                clinic_name VARCHAR(200),
                clinic_address TEXT,
                specialization VARCHAR(100),
                notes TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_referral_doctors_phone ON referral_doctors(phone)")
        
        print("Creating external_referrals table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS external_referrals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referral_number VARCHAR(20) UNIQUE NOT NULL,
                client_name VARCHAR(200) NOT NULL,
                client_phone VARCHAR(20),
                client_email VARCHAR(255),
                client_address TEXT,
                client_dob DATE,
                client_sex VARCHAR(10),
                patient_id INTEGER REFERENCES patients(id),
                referral_doctor_id INTEGER NOT NULL REFERENCES referral_doctors(id),
                technician_user_id INTEGER NOT NULL REFERENCES users(id),
                branch_id INTEGER REFERENCES branches(id),
                referral_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                notes TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                service_fee DECIMAL(10, 2) DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_external_referrals_number ON external_referrals(referral_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_external_referrals_doctor ON external_referrals(referral_doctor_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_external_referrals_technician ON external_referrals(technician_user_id)")
        
        print("Creating technician_scans table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS technician_scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_number VARCHAR(20) UNIQUE NOT NULL,
                scan_type VARCHAR(20) NOT NULL,
                patient_id INTEGER REFERENCES patients(id),
                external_referral_id INTEGER REFERENCES external_referrals(id),
                visit_id INTEGER REFERENCES visits(id),
                consultation_id INTEGER REFERENCES consultations(id),
                performed_by_id INTEGER NOT NULL REFERENCES users(id),
                branch_id INTEGER REFERENCES branches(id),
                scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                od_results TEXT,
                os_results TEXT,
                results_summary TEXT,
                pdf_file_path VARCHAR(500),
                notes TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                reviewed_by_id INTEGER REFERENCES users(id),
                reviewed_at DATETIME,
                doctor_notes TEXT,
                requested_by_id INTEGER REFERENCES users(id),
                requested_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_technician_scans_number ON technician_scans(scan_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_technician_scans_patient ON technician_scans(patient_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_technician_scans_referral ON technician_scans(external_referral_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_technician_scans_visit ON technician_scans(visit_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_technician_scans_type ON technician_scans(scan_type)")
        
        print("Creating referral_payment_settings table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS referral_payment_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                referral_doctor_id INTEGER REFERENCES referral_doctors(id),
                payment_type VARCHAR(20) NOT NULL,
                rate DECIMAL(10, 2) NOT NULL,
                effective_from DATE DEFAULT CURRENT_DATE,
                effective_to DATE,
                is_active BOOLEAN DEFAULT 1,
                created_by_id INTEGER REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """)
        
        print("Creating referral_payments table...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS referral_payments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payment_number VARCHAR(20) UNIQUE NOT NULL,
                referral_doctor_id INTEGER NOT NULL REFERENCES referral_doctors(id),
                external_referral_id INTEGER REFERENCES external_referrals(id),
                service_amount DECIMAL(10, 2) DEFAULT 0,
                payment_type VARCHAR(20),
                payment_rate DECIMAL(10, 2),
                amount DECIMAL(10, 2) NOT NULL,
                is_paid BOOLEAN DEFAULT 0,
                payment_method VARCHAR(50),
                payment_date DATETIME,
                reference_number VARCHAR(100),
                paid_by_id INTEGER REFERENCES users(id),
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME
            )
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_referral_payments_number ON referral_payments(payment_number)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_referral_payments_doctor ON referral_payments(referral_doctor_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_referral_payments_paid ON referral_payments(is_paid)")
        
        conn.commit()
        print("Migration completed successfully!")
        
        # Verify tables were created
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%referral%' OR name LIKE '%technician_scans%'")
        tables = cursor.fetchall()
        print(f"Created tables: {[t[0] for t in tables]}")
        
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    run_migration()
