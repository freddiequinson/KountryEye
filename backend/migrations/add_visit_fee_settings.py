"""Add visit_fee_settings table for visit type pricing"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Create visit_fee_settings table
        await conn.execute(text("""
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
        """))
        print("Created visit_fee_settings table")
        
        # Insert default global settings if not exists
        result = await conn.execute(text("SELECT COUNT(*) FROM visit_fee_settings WHERE branch_id IS NULL"))
        count = result.scalar()
        if count == 0:
            await conn.execute(text("""
                INSERT INTO visit_fee_settings (branch_id, initial_visit_fee, review_visit_fee, subsequent_visit_fee, review_period_days)
                VALUES (NULL, 50.00, 30.00, 40.00, 7)
            """))
            print("Inserted default global visit fee settings")
        
        print("Migration completed: visit_fee_settings")

if __name__ == "__main__":
    asyncio.run(migrate())
