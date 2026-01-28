"""
Migration script to add category_type field to product_categories table.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./data/kountry_eyecare.db"


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting category type migration...")
        
        # Check existing columns in product_categories
        cursor = await db.execute("PRAGMA table_info(product_categories)")
        columns = await cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        # Add category_type column
        if 'category_type' not in column_names:
            print("Adding category_type column to product_categories...")
            await db.execute("ALTER TABLE product_categories ADD COLUMN category_type VARCHAR(50) DEFAULT 'general'")
        else:
            print("category_type column already exists in product_categories")
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
