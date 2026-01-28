import asyncio
from sqlalchemy import select
from app.core.database import get_db
from app.models.revenue import Revenue
from app.models.sales import Sale

async def backfill_revenue():
    """Create revenue records for existing sales that don't have them"""
    async for db in get_db():
        print("Fetching all sales...")
        result = await db.execute(select(Sale))
        sales = result.scalars().all()
        
        print(f"Found {len(sales)} sales records")
        
        created_count = 0
        for sale in sales:
            # Check if revenue record already exists for this sale
            result = await db.execute(
                select(Revenue).where(
                    Revenue.reference_type == "sale",
                    Revenue.reference_id == sale.id
                )
            )
            existing_revenue = result.scalar_one_or_none()
            
            if existing_revenue:
                print(f"  Sale {sale.receipt_number}: Revenue already exists (ID: {existing_revenue.id})")
                continue
            
            # Create revenue record
            revenue = Revenue(
                category="product_sale",
                description=f"Sale {sale.receipt_number}",
                amount=sale.total_amount,
                payment_method="cash",  # Default to cash if not specified
                reference_type="sale",
                reference_id=sale.id,
                patient_id=sale.patient_id,
                branch_id=sale.branch_id,
                recorded_by_id=1,  # System user
                created_at=sale.created_at  # Use the same timestamp as the sale
            )
            db.add(revenue)
            created_count += 1
            print(f"  Sale {sale.receipt_number}: Created revenue record (Amount: {sale.total_amount})")
        
        if created_count > 0:
            await db.commit()
            print(f"\n✓ Created {created_count} revenue records")
        else:
            print("\n✓ No new revenue records needed")
        
        break

if __name__ == "__main__":
    asyncio.run(backfill_revenue())
