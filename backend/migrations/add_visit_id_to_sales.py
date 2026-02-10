"""Add visit_id column to sales table for checkout linking"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(text("PRAGMA table_info(sales)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'visit_id' not in columns:
            await conn.execute(text("ALTER TABLE sales ADD COLUMN visit_id INTEGER REFERENCES visits(id)"))
            print("Added visit_id column to sales table")
        else:
            print("visit_id column already exists in sales table")
        
        print("Migration completed: visit_id added to sales")

if __name__ == "__main__":
    asyncio.run(migrate())
