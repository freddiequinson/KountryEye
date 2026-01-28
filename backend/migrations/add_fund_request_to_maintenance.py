"""
Migration script to add fund_request_id to maintenance_logs table.
This allows linking maintenance records to fund requests to prevent double expense logging.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./kountry_eyecare.db"


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting migration...")
        
        # First check if maintenance_logs table exists
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='maintenance_logs'")
        table_exists = await cursor.fetchone()
        
        if not table_exists:
            print("maintenance_logs table does not exist. Creating it...")
            await db.execute("""
                CREATE TABLE maintenance_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    asset_id INTEGER NOT NULL REFERENCES assets(id),
                    technician_id INTEGER REFERENCES technicians(id),
                    maintenance_type VARCHAR(100),
                    description TEXT,
                    performed_by VARCHAR(200),
                    performed_date DATE NOT NULL,
                    cost DECIMAL(10, 2),
                    next_due_date DATE,
                    status VARCHAR(50) DEFAULT 'completed',
                    checklist_completed JSON,
                    notes TEXT,
                    created_by_id INTEGER REFERENCES users(id),
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    fund_request_id INTEGER REFERENCES fund_requests(id)
                )
            """)
            print("maintenance_logs table created with fund_request_id column!")
        else:
            # Check if fund_request_id column exists in maintenance_logs
            cursor = await db.execute("PRAGMA table_info(maintenance_logs)")
            columns = await cursor.fetchall()
            column_names = [col[1] for col in columns]
            
            if 'fund_request_id' not in column_names:
                print("Adding fund_request_id column to maintenance_logs...")
                await db.execute("ALTER TABLE maintenance_logs ADD COLUMN fund_request_id INTEGER REFERENCES fund_requests(id)")
                print("fund_request_id column added successfully!")
            else:
                print("fund_request_id column already exists in maintenance_logs")
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
