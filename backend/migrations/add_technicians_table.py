"""
Migration script to add technicians table and technician_id to maintenance_logs.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./kountry_eyecare.db"


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting migration...")
        
        # Create technicians table
        print("Creating technicians table...")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS technicians (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                phone VARCHAR(20),
                email VARCHAR(255),
                company VARCHAR(200),
                specialization VARCHAR(200),
                notes TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Check if technician_id column exists in maintenance_logs
        cursor = await db.execute("PRAGMA table_info(maintenance_logs)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'technician_id' not in column_names:
            print("Adding technician_id column to maintenance_logs...")
            await db.execute("ALTER TABLE maintenance_logs ADD COLUMN technician_id INTEGER REFERENCES technicians(id)")
        else:
            print("technician_id column already exists in maintenance_logs")
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
