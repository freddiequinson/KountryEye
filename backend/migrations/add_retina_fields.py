"""Add retina_od and retina_os fields to clinical_records table"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Check if columns exist
        result = await conn.execute(text("PRAGMA table_info(clinical_records)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'retina_od' not in columns:
            await conn.execute(text("ALTER TABLE clinical_records ADD COLUMN retina_od TEXT"))
            print("Added retina_od column")
        else:
            print("retina_od column already exists")
        
        if 'retina_os' not in columns:
            await conn.execute(text("ALTER TABLE clinical_records ADD COLUMN retina_os TEXT"))
            print("Added retina_os column")
        else:
            print("retina_os column already exists")
        
        print("Migration completed: retina fields added")

if __name__ == "__main__":
    asyncio.run(migrate())
