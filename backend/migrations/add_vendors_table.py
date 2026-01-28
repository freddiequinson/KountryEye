"""
Migration script to add vendors table and update imports table.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./kountry_eyecare.db"


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting migration...")
        
        # Create vendors table
        print("Creating vendors table...")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS vendors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name VARCHAR(200) NOT NULL,
                contact_person VARCHAR(100),
                email VARCHAR(255),
                phone VARCHAR(20),
                address TEXT,
                notes TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Check if vendor_id column exists in imports
        cursor = await db.execute("PRAGMA table_info(imports)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'vendor_id' not in column_names:
            print("Adding vendor_id column to imports...")
            await db.execute("ALTER TABLE imports ADD COLUMN vendor_id INTEGER REFERENCES vendors(id)")
        else:
            print("vendor_id column already exists in imports")
        
        if 'total_cost' not in column_names:
            print("Adding total_cost column to imports...")
            await db.execute("ALTER TABLE imports ADD COLUMN total_cost DECIMAL(12,2) DEFAULT 0")
        else:
            print("total_cost column already exists in imports")
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
