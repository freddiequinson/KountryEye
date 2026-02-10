"""Run all new migrations for the feature update"""
import sqlite3
import os

def get_columns(cursor, table_name):
    """Get list of column names for a table"""
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]

def migrate():
    # Get the database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'kountry_eyecare.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("=" * 50)
    print("Running all new migrations...")
    print("=" * 50)
    
    # 1. Add retina fields to clinical_records
    print("\n1. Adding retina fields to clinical_records...")
    columns = get_columns(cursor, 'clinical_records')
    
    if 'retina_od' not in columns:
        cursor.execute("ALTER TABLE clinical_records ADD COLUMN retina_od TEXT")
        print("   Added retina_od column")
    if 'retina_os' not in columns:
        cursor.execute("ALTER TABLE clinical_records ADD COLUMN retina_os TEXT")
        print("   Added retina_os column")
    
    # 2. Create visit_fee_settings table
    print("\n2. Creating visit_fee_settings table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visit_fee_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            branch_id INTEGER REFERENCES branches(id),
            initial_visit_fee DECIMAL(10, 2) DEFAULT 0,
            review_visit_fee DECIMAL(10, 2) DEFAULT 0,
            subsequent_visit_fee DECIMAL(10, 2) DEFAULT 0,
            review_period_days INTEGER DEFAULT 7,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_by_id INTEGER REFERENCES users(id)
        )
    """)
    
    # Insert default settings if not exists
    cursor.execute("SELECT COUNT(*) FROM visit_fee_settings WHERE branch_id IS NULL")
    count = cursor.fetchone()[0]
    if count == 0:
        cursor.execute("""
            INSERT INTO visit_fee_settings (branch_id, initial_visit_fee, review_visit_fee, subsequent_visit_fee, review_period_days)
            VALUES (NULL, 50.00, 30.00, 40.00, 7)
        """)
        print("   Inserted default visit fee settings")
    
    # 3. Create branch_assignment_history table
    print("\n3. Creating branch_assignment_history table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS branch_assignment_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            branch_id INTEGER NOT NULL REFERENCES branches(id),
            previous_branch_id INTEGER REFERENCES branches(id),
            assigned_by_id INTEGER REFERENCES users(id),
            notes TEXT,
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # 4. Add branch_confirmed_at to users
    print("\n4. Adding branch_confirmed_at to users...")
    columns = get_columns(cursor, 'users')
    if 'branch_confirmed_at' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN branch_confirmed_at DATETIME")
        print("   Added branch_confirmed_at column")
    
    # 5. Add visit_id to sales
    print("\n5. Adding visit_id to sales...")
    columns = get_columns(cursor, 'sales')
    if 'visit_id' not in columns:
        cursor.execute("ALTER TABLE sales ADD COLUMN visit_id INTEGER REFERENCES visits(id)")
        print("   Added visit_id column")
    
    # 6. Add checkout_time to visits
    print("\n6. Adding checkout_time to visits...")
    columns = get_columns(cursor, 'visits')
    if 'checkout_time' not in columns:
        cursor.execute("ALTER TABLE visits ADD COLUMN checkout_time DATETIME")
        print("   Added checkout_time column")
    
    # 7. Add visit type fees to consultation_types
    print("\n7. Adding visit type fees to consultation_types...")
    columns = get_columns(cursor, 'consultation_types')
    if 'initial_fee' not in columns:
        cursor.execute("ALTER TABLE consultation_types ADD COLUMN initial_fee DECIMAL(10,2) DEFAULT 0")
        print("   Added initial_fee column")
    if 'review_fee' not in columns:
        cursor.execute("ALTER TABLE consultation_types ADD COLUMN review_fee DECIMAL(10,2) DEFAULT 0")
        print("   Added review_fee column")
    if 'subsequent_fee' not in columns:
        cursor.execute("ALTER TABLE consultation_types ADD COLUMN subsequent_fee DECIMAL(10,2) DEFAULT 0")
        print("   Added subsequent_fee column")
    
    # 6. Add branch_verification_required to users
    print("\n6. Adding branch_verification_required to users...")
    columns = get_columns(cursor, 'users')
    if 'branch_verification_required' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN branch_verification_required BOOLEAN DEFAULT 0")
        print("   Added branch_verification_required column")
    
    # 7. Create branch_assignments table for tracking staff rotation history
    print("\n7. Creating branch_assignments table...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS branch_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL REFERENCES users(id),
            branch_id INTEGER NOT NULL REFERENCES branches(id),
            assigned_by_id INTEGER NOT NULL REFERENCES users(id),
            assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            effective_from DATETIME NOT NULL,
            effective_until DATETIME,
            is_current BOOLEAN DEFAULT 1,
            verified BOOLEAN DEFAULT 0,
            verified_at DATETIME,
            verification_note TEXT,
            notes TEXT
        )
    """)
    print("   Created branch_assignments table")
    
    # Create index for faster lookups
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_branch_assignments_user ON branch_assignments(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_branch_assignments_current ON branch_assignments(user_id, is_current)")
    print("   Created indexes")
    
    # 8. Add new prescription fields for spectacles prescription form
    print("\n8. Adding new prescription fields...")
    columns = get_columns(cursor, 'prescriptions')
    if 'va_od' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN va_od VARCHAR(20)")
        print("   Added va_od")
    if 'va_os' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN va_os VARCHAR(20)")
        print("   Added va_os")
    if 'segment_height' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN segment_height VARCHAR(20)")
        print("   Added segment_height")
    if 'frame_code' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN frame_code VARCHAR(100)")
        print("   Added frame_code")
    if 'frame_size' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN frame_size VARCHAR(50)")
        print("   Added frame_size")
    if 'remarks' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN remarks TEXT")
        print("   Added remarks")
    if 'dispensed_by_name' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN dispensed_by_name VARCHAR(200)")
        print("   Added dispensed_by_name")
    if 'delivery_date' not in columns:
        cursor.execute("ALTER TABLE prescriptions ADD COLUMN delivery_date DATETIME")
        print("   Added delivery_date")
    
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 50)
    print("All migrations completed successfully!")
    print("=" * 50)

if __name__ == "__main__":
    migrate()
