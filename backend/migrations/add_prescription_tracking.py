"""
Migration script to add prescription tracking fields and out_of_stock_requests table.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./data/kountry_eyecare.db"


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting prescription tracking migration...")
        
        # Check existing columns in prescription_items
        cursor = await db.execute("PRAGMA table_info(prescription_items)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        # Add product_id column to prescription_items
        if 'product_id' not in column_names:
            print("Adding product_id column to prescription_items...")
            await db.execute("ALTER TABLE prescription_items ADD COLUMN product_id INTEGER REFERENCES products(id)")
        else:
            print("product_id column already exists in prescription_items")
        
        # Add is_external column to prescription_items
        if 'is_external' not in column_names:
            print("Adding is_external column to prescription_items...")
            await db.execute("ALTER TABLE prescription_items ADD COLUMN is_external BOOLEAN DEFAULT 0")
        else:
            print("is_external column already exists in prescription_items")
        
        # Add was_out_of_stock column to prescription_items
        if 'was_out_of_stock' not in column_names:
            print("Adding was_out_of_stock column to prescription_items...")
            await db.execute("ALTER TABLE prescription_items ADD COLUMN was_out_of_stock BOOLEAN DEFAULT 0")
        else:
            print("was_out_of_stock column already exists in prescription_items")
        
        # Create out_of_stock_requests table for analytics
        print("Creating out_of_stock_requests table...")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS out_of_stock_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER REFERENCES products(id),
                product_name VARCHAR(200) NOT NULL,
                prescription_id INTEGER REFERENCES prescriptions(id),
                patient_id INTEGER REFERENCES patients(id),
                prescribed_by_id INTEGER REFERENCES users(id),
                quantity_requested INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
