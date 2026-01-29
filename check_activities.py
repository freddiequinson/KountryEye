import asyncio
from sqlalchemy import select
from app.db.session import async_session
from app.models.employee import ActivityLog

async def check():
    async with async_session() as db:
        result = await db.execute(select(ActivityLog).order_by(ActivityLog.created_at.desc()).limit(10))
        logs = result.scalars().all()
        for log in logs:
            print(f"User {log.user_id}: {log.action} - {log.description}")
        if not logs:
            print("No logs found")

asyncio.run(check())
