#!/usr/bin/env python3
import asyncio
import sys
sys.path.insert(0, '/var/www/kountryeye/backend')

from app.core.database import engine, Base
from app.models import communication

async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print('Tables created/verified successfully')

if __name__ == "__main__":
    asyncio.run(create_tables())
