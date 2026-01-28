"""
Migration script to add asset columns for maintenance checklist and image.
Run this script to apply the migration.
"""
import asyncio
import aiosqlite

DATABASE_PATH = "./kountry_eyecare.db"


async def migrate():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        print("Starting migration...")
        
        # Check existing columns in assets table
        cursor = await db.execute("PRAGMA table_info(assets)")
        columns = await cursor.fetchall()
        asset_column_names = [col[1] for col in columns]
        
        if 'image_url' not in asset_column_names:
            print("Adding image_url column to assets...")
            await db.execute("ALTER TABLE assets ADD COLUMN image_url VARCHAR(500)")
        else:
            print("image_url column already exists in assets")
        
        if 'maintenance_checklist' not in asset_column_names:
            print("Adding maintenance_checklist column to assets...")
            await db.execute("ALTER TABLE assets ADD COLUMN maintenance_checklist JSON")
        else:
            print("maintenance_checklist column already exists in assets")
        
        # Check existing columns in maintenance_logs table
        cursor = await db.execute("PRAGMA table_info(maintenance_logs)")
        columns = await cursor.fetchall()
        log_column_names = [col[1] for col in columns]
        
        if 'checklist_completed' not in log_column_names:
            print("Adding checklist_completed column to maintenance_logs...")
            await db.execute("ALTER TABLE maintenance_logs ADD COLUMN checklist_completed JSON")
        else:
            print("checklist_completed column already exists in maintenance_logs")
        
        await db.commit()
        print("Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
