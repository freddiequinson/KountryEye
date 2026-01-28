import asyncio
from app.core.database import get_db
from app.models.revenue import Revenue
from sqlalchemy import select, func

async def check_revenue():
    async for db in get_db():
        # Count total revenue records
        result = await db.execute(select(func.count(Revenue.id)))
        total = result.scalar()
        print(f'Total revenue records: {total}')
        
        # Get a sample
        if total > 0:
            result = await db.execute(select(Revenue).limit(5))
            revenues = result.scalars().all()
            print('\nSample records:')
            for r in revenues:
                print(f'  ID: {r.id}, Amount: {r.amount}, Category: {r.category}, Created: {r.created_at}')
        break

asyncio.run(check_revenue())
