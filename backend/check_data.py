import asyncio
import sys
from datetime import datetime, date, timedelta
from sqlalchemy import select, func, text
from app.core.database import get_db
from app.models.revenue import Revenue
from app.models.sales import Sale

async def check_data():
    async for db in get_db():
        print("=" * 60)
        print("CHECKING REVENUE DATA")
        print("=" * 60)
        
        # Count total revenue records
        result = await db.execute(select(func.count(Revenue.id)))
        total_revenue = result.scalar()
        print(f"\nTotal revenue records: {total_revenue}")
        
        if total_revenue > 0:
            # Get date range of revenue records
            result = await db.execute(
                select(
                    func.min(Revenue.created_at),
                    func.max(Revenue.created_at)
                )
            )
            min_date, max_date = result.first()
            print(f"Revenue date range: {min_date} to {max_date}")
            
            # Get sample records
            result = await db.execute(
                select(Revenue)
                .order_by(Revenue.created_at.desc())
                .limit(5)
            )
            revenues = result.scalars().all()
            print(f"\nSample revenue records (most recent 5):")
            for r in revenues:
                print(f"  ID: {r.id}, Amount: {r.amount}, Category: {r.category}")
                print(f"    Created: {r.created_at}")
                print(f"    Date only: {r.created_at.date() if r.created_at else None}")
            
            # Check today's records
            today = date.today()
            result = await db.execute(
                select(func.count(Revenue.id))
                .where(func.date(Revenue.created_at) == today)
            )
            today_count = result.scalar()
            print(f"\nToday ({today}) revenue records: {today_count}")
            
            # Check this month's records
            month_start = today.replace(day=1)
            result = await db.execute(
                select(func.count(Revenue.id))
                .where(func.date(Revenue.created_at) >= month_start)
                .where(func.date(Revenue.created_at) <= today)
            )
            month_count = result.scalar()
            print(f"This month ({month_start} to {today}) revenue records: {month_count}")
        
        print("\n" + "=" * 60)
        print("CHECKING SALES DATA")
        print("=" * 60)
        
        # Count total sales
        result = await db.execute(select(func.count(Sale.id)))
        total_sales = result.scalar()
        print(f"\nTotal sales records: {total_sales}")
        
        if total_sales > 0:
            # Get date range of sales
            result = await db.execute(
                select(
                    func.min(Sale.created_at),
                    func.max(Sale.created_at)
                )
            )
            min_date, max_date = result.first()
            print(f"Sales date range: {min_date} to {max_date}")
            
            # Get sample records
            result = await db.execute(
                select(Sale)
                .order_by(Sale.created_at.desc())
                .limit(5)
            )
            sales = result.scalars().all()
            print(f"\nSample sales records (most recent 5):")
            for s in sales:
                print(f"  ID: {s.id}, Receipt: {s.receipt_number}, Total: {s.total_amount}")
                print(f"    Created: {s.created_at}")
                print(f"    Date only: {s.created_at.date() if s.created_at else None}")
        
        print("\n" + "=" * 60)
        print(f"Current server date: {date.today()}")
        print(f"Current server datetime: {datetime.now()}")
        print("=" * 60)
        
        break

if __name__ == "__main__":
    asyncio.run(check_data())
