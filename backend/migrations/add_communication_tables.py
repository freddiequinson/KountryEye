"""
Migration script to add communication tables:
- fund_requests (memo/fund request system)
- conversations (messaging)
- conversation_participants
- messages
- notifications

Run this script to create the tables:
    python migrations/add_communication_tables.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import engine


async def run_migration():
    async with engine.begin() as conn:
        # Create fund_requests table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS fund_requests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                amount DECIMAL(10, 2) NOT NULL,
                purpose VARCHAR(100),
                status VARCHAR(20) DEFAULT 'pending',
                requested_by_id INTEGER NOT NULL REFERENCES users(id),
                branch_id INTEGER REFERENCES branches(id),
                reviewed_by_id INTEGER REFERENCES users(id),
                reviewed_at DATETIME,
                review_notes TEXT,
                disbursed_at DATETIME,
                disbursement_method VARCHAR(50),
                disbursement_reference VARCHAR(100),
                received_at DATETIME,
                receipt_notes TEXT,
                expense_id INTEGER REFERENCES expenses(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("✓ Created fund_requests table")

        # Create conversations table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                is_group BOOLEAN DEFAULT 0,
                name VARCHAR(255),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("✓ Created conversations table")

        # Create conversation_participants table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS conversation_participants (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id),
                user_id INTEGER NOT NULL REFERENCES users(id),
                last_read_at DATETIME,
                is_typing BOOLEAN DEFAULT 0,
                typing_updated_at DATETIME,
                is_muted BOOLEAN DEFAULT 0,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(conversation_id, user_id)
            )
        """))
        print("✓ Created conversation_participants table")

        # Create messages table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversation_id INTEGER NOT NULL REFERENCES conversations(id),
                sender_id INTEGER NOT NULL REFERENCES users(id),
                content TEXT NOT NULL,
                message_type VARCHAR(20) DEFAULT 'text',
                fund_request_id INTEGER REFERENCES fund_requests(id),
                product_id INTEGER REFERENCES products(id),
                is_edited BOOLEAN DEFAULT 0,
                edited_at DATETIME,
                is_deleted BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("✓ Created messages table")

        # Create notifications table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id),
                title VARCHAR(255) NOT NULL,
                message TEXT,
                notification_type VARCHAR(50) DEFAULT 'system',
                reference_type VARCHAR(50),
                reference_id INTEGER,
                action_url VARCHAR(255),
                is_read BOOLEAN DEFAULT 0,
                read_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("✓ Created notifications table")

        # Create indexes for better performance
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fund_requests_requested_by ON fund_requests(requested_by_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON fund_requests(status)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON conversation_participants(user_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_conversation_participants_conv ON conversation_participants(conversation_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read)"))
        print("✓ Created indexes")

        print("\n✅ Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
