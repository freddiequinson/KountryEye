"""Add branch_assignment_history table and branch_confirmed_at to users"""
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Create branch_assignment_history table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS branch_assignment_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                branch_id INTEGER NOT NULL REFERENCES branches(id),
                previous_branch_id INTEGER REFERENCES branches(id),
                assigned_by_id INTEGER REFERENCES users(id),
                notes TEXT,
                assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("Created branch_assignment_history table")
        
        # Add branch_confirmed_at to users table
        result = await conn.execute(text("PRAGMA table_info(users)"))
        columns = [row[1] for row in result.fetchall()]
        
        if 'branch_confirmed_at' not in columns:
            await conn.execute(text("ALTER TABLE users ADD COLUMN branch_confirmed_at DATETIME"))
            print("Added branch_confirmed_at column to users")
        else:
            print("branch_confirmed_at column already exists")
        
        print("Migration completed: branch assignment history")

if __name__ == "__main__":
    asyncio.run(migrate())
