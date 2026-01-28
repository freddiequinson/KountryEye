import asyncio
from datetime import datetime, date, timedelta
from sqlalchemy import select, func
from app.core.database import get_db
from app.models.patient import Visit

async def check_visits():
    async for db in get_db():
        print("=" * 60)
        print("CHECKING VISIT DATA")
        print("=" * 60)
        
        # Count total visits
        result = await db.execute(select(func.count(Visit.id)))
        total_visits = result.scalar()
        print(f"\nTotal visit records: {total_visits}")
        
        if total_visits > 0:
            # Get date range of visits
            result = await db.execute(
                select(
                    func.min(Visit.visit_date),
                    func.max(Visit.visit_date)
                )
            )
            min_date, max_date = result.first()
            print(f"Visit date range: {min_date} to {max_date}")
            
            # Get sample records
            result = await db.execute(
                select(Visit)
                .order_by(Visit.visit_date.desc())
                .limit(10)
            )
            visits = result.scalars().all()
            print(f"\nSample visit records (most recent 10):")
            for v in visits:
                print(f"  ID: {v.id}, Visit #: {v.visit_number}")
                print(f"    Visit Date: {v.visit_date}")
                print(f"    Date only: {v.visit_date.date() if v.visit_date else None}")
                print(f"    Status: {v.status}")
            
            # Check today's records
            today = date.today()
            result = await db.execute(
                select(func.count(Visit.id))
                .where(func.date(Visit.visit_date) == today)
            )
            today_count = result.scalar()
            print(f"\nToday ({today}) visit records: {today_count}")
            
            # Check yesterday's records
            yesterday = today - timedelta(days=1)
            result = await db.execute(
                select(func.count(Visit.id))
                .where(func.date(Visit.visit_date) == yesterday)
            )
            yesterday_count = result.scalar()
            print(f"Yesterday ({yesterday}) visit records: {yesterday_count}")
            
            # Check this week's records
            week_start = today - timedelta(days=today.weekday())
            result = await db.execute(
                select(func.count(Visit.id))
                .where(func.date(Visit.visit_date) >= week_start)
                .where(func.date(Visit.visit_date) <= today)
            )
            week_count = result.scalar()
            print(f"This week ({week_start} to {today}) visit records: {week_count}")
            
            # Check this month's records
            month_start = today.replace(day=1)
            result = await db.execute(
                select(func.count(Visit.id))
                .where(func.date(Visit.visit_date) >= month_start)
                .where(func.date(Visit.visit_date) <= today)
            )
            month_count = result.scalar()
            print(f"This month ({month_start} to {today}) visit records: {month_count}")
        
        print("\n" + "=" * 60)
        print(f"Current server date: {date.today()}")
        print(f"Current server datetime: {datetime.now()}")
        print("=" * 60)
        
        break

if __name__ == "__main__":
    asyncio.run(check_visits())
