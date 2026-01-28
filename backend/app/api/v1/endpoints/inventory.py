from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.inventory import (
    Warehouse, WarehouseStock, Import, ImportItem,
    StockTransfer, StockTransferItem, StockAlert, Vendor
)
from app.models.sales import BranchStock
from app.schemas.inventory import (
    WarehouseCreate, WarehouseResponse, WarehouseStockResponse,
    ImportCreate, ImportResponse,
    StockTransferCreate, StockTransferResponse,
    StockAlertResponse
)

router = APIRouter()


@router.get("/warehouses", response_model=List[WarehouseResponse])
async def get_warehouses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Warehouse).where(Warehouse.is_active == True))
    return result.scalars().all()


@router.post("/warehouses", response_model=WarehouseResponse)
async def create_warehouse(
    warehouse_in: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    warehouse = Warehouse(**warehouse_in.model_dump())
    db.add(warehouse)
    await db.commit()
    await db.refresh(warehouse)
    return warehouse


@router.get("/warehouses/{warehouse_id}/stock")
async def get_warehouse_stock(
    warehouse_id: int,
    low_stock_only: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from sqlalchemy.orm import selectinload
    from app.models.sales import Product
    
    query = select(WarehouseStock).options(
        selectinload(WarehouseStock.product)
    ).where(WarehouseStock.warehouse_id == warehouse_id)
    
    if low_stock_only:
        query = query.where(WarehouseStock.quantity <= WarehouseStock.min_quantity)
    
    result = await db.execute(query)
    stocks = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "warehouse_id": s.warehouse_id,
            "product_id": s.product_id,
            "product": {
                "id": s.product.id,
                "name": s.product.name,
                "sku": s.product.sku,
                "unit_price": float(s.product.unit_price) if s.product.unit_price else 0,
                "cost_price": float(s.product.cost_price) if s.product.cost_price else 0,
            } if s.product else None,
            "quantity": s.quantity,
            "min_quantity": s.min_quantity,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        }
        for s in stocks
    ]


@router.get("/imports", response_model=List[ImportResponse])
async def get_imports(
    warehouse_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Import)
    if warehouse_id:
        query = query.where(Import.warehouse_id == warehouse_id)
    if status:
        query = query.where(Import.status == status)
    
    result = await db.execute(query.order_by(Import.created_at.desc()))
    return result.scalars().all()


@router.post("/imports", response_model=ImportResponse)
async def create_import(
    import_in: ImportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    vendor_id = import_in.vendor_id
    
    # Auto-create vendor if supplier_name is provided and no vendor_id
    if import_in.supplier_name and not vendor_id:
        # Check if vendor with this name already exists
        existing_vendor = await db.execute(
            select(Vendor).where(Vendor.name == import_in.supplier_name)
        )
        vendor = existing_vendor.scalar_one_or_none()
        
        if not vendor:
            # Create new vendor
            vendor = Vendor(name=import_in.supplier_name)
            db.add(vendor)
            await db.flush()
        
        vendor_id = vendor.id
    
    import_record = Import(
        warehouse_id=import_in.warehouse_id,
        vendor_id=vendor_id,
        supplier_name=import_in.supplier_name,
        reference_number=import_in.reference_number,
        expected_date=import_in.expected_date,
        notes=import_in.notes,
        created_by_id=current_user.id
    )
    db.add(import_record)
    await db.flush()
    
    for item_in in import_in.items:
        item = ImportItem(
            import_id=import_record.id,
            product_id=item_in.product_id,
            expected_quantity=item_in.expected_quantity,
            unit_cost=item_in.unit_cost
        )
        db.add(item)
    
    await db.commit()
    await db.refresh(import_record)
    return import_record


@router.get("/imports/pending-arrival")
async def get_pending_arrival_imports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get imports that are due for arrival (expected_date <= today and status is pending)"""
    from sqlalchemy.orm import joinedload
    
    today = date.today()
    result = await db.execute(
        select(Import)
        .options(joinedload(Import.vendor), joinedload(Import.warehouse))
        .where(Import.status == "pending")
        .where(Import.expected_date <= today)
        .order_by(Import.expected_date)
    )
    imports = result.unique().scalars().all()
    
    return [
        {
            "id": i.id,
            "reference_number": i.reference_number,
            "vendor": {"id": i.vendor.id, "name": i.vendor.name} if i.vendor else None,
            "supplier_name": i.supplier_name,
            "warehouse": {"id": i.warehouse.id, "name": i.warehouse.name} if i.warehouse else None,
            "expected_date": i.expected_date.isoformat() if i.expected_date else None,
            "total_cost": float(i.total_cost) if i.total_cost else 0,
            "status": i.status,
            "days_overdue": (today - i.expected_date).days if i.expected_date else 0,
        }
        for i in imports
    ]


@router.get("/imports/{import_id}")
async def get_import(
    import_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Import).where(Import.id == import_id))
    import_record = result.scalar_one_or_none()
    if not import_record:
        raise HTTPException(status_code=404, detail="Import not found")
    return import_record


@router.get("/imports/{import_id}/items")
async def get_import_items(
    import_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from sqlalchemy.orm import selectinload
    from app.models.sales import Product
    
    result = await db.execute(
        select(ImportItem)
        .options(selectinload(ImportItem.product))
        .where(ImportItem.import_id == import_id)
    )
    items = result.scalars().all()
    return [
        {
            "id": item.id,
            "product_id": item.product_id,
            "product": {"id": item.product.id, "name": item.product.name, "sku": item.product.sku} if item.product else None,
            "expected_quantity": item.expected_quantity,
            "received_quantity": item.received_quantity,
            "unit_cost": float(item.unit_cost) if item.unit_cost else None,
        }
        for item in items
    ]


@router.post("/imports/{import_id}/items")
async def add_import_item(
    import_id: int,
    item_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.sales import Product
    from sqlalchemy import func
    
    result = await db.execute(select(Import).where(Import.id == import_id))
    import_record = result.scalar_one_or_none()
    if not import_record:
        raise HTTPException(status_code=404, detail="Import not found")
    
    if import_record.status != "pending":
        raise HTTPException(status_code=400, detail="Cannot add items to a non-pending import")
    
    product_id = item_data.get("product_id")
    
    # Handle new product creation
    if "new_product" in item_data:
        new_prod = item_data["new_product"]
        count_result = await db.execute(select(func.count(Product.id)))
        count = count_result.scalar() + 1
        sku = new_prod.get("sku") or f"PRD-00-{count:05d}"
        
        product = Product(
            name=new_prod["name"],
            sku=sku,
            unit_price=new_prod["unit_price"],
            cost_price=new_prod.get("cost_price"),
        )
        db.add(product)
        await db.flush()
        product_id = product.id
    
    item = ImportItem(
        import_id=import_id,
        product_id=product_id,
        expected_quantity=item_data["expected_quantity"],
        unit_cost=item_data.get("unit_cost")
    )
    db.add(item)
    
    # Update total cost
    items_result = await db.execute(
        select(ImportItem).where(ImportItem.import_id == import_id)
    )
    all_items = items_result.scalars().all()
    total_cost = sum((i.unit_cost or 0) * i.expected_quantity for i in all_items)
    total_cost += (item_data.get("unit_cost") or 0) * item_data["expected_quantity"]
    import_record.total_cost = total_cost
    
    await db.commit()
    return {"message": "Item added successfully", "item_id": item.id}


@router.delete("/imports/{import_id}/items/{item_id}")
async def remove_import_item(
    import_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(ImportItem).where(
            ImportItem.id == item_id,
            ImportItem.import_id == import_id
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get import record to update total cost
    import_result = await db.execute(select(Import).where(Import.id == import_id))
    import_record = import_result.scalar_one_or_none()
    
    await db.delete(item)
    
    # Recalculate total cost after deletion
    items_result = await db.execute(
        select(ImportItem).where(ImportItem.import_id == import_id)
    )
    remaining_items = items_result.scalars().all()
    total_cost = sum((i.unit_cost or 0) * i.expected_quantity for i in remaining_items if i.id != item_id)
    if import_record:
        import_record.total_cost = total_cost
    await db.commit()
    return {"message": "Item removed successfully"}


@router.put("/imports/{import_id}/receive")
async def receive_import(
    import_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Import).where(Import.id == import_id))
    import_record = result.scalar_one_or_none()
    if not import_record:
        raise HTTPException(status_code=404, detail="Import not found")
    
    items_result = await db.execute(
        select(ImportItem).where(ImportItem.import_id == import_id)
    )
    items = items_result.scalars().all()
    
    for item in items:
        item.received_quantity = item.expected_quantity
        
        stock_result = await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.warehouse_id == import_record.warehouse_id,
                WarehouseStock.product_id == item.product_id
            )
        )
        stock = stock_result.scalar_one_or_none()
        
        if stock:
            stock.quantity += item.expected_quantity
        else:
            stock = WarehouseStock(
                warehouse_id=import_record.warehouse_id,
                product_id=item.product_id,
                quantity=item.expected_quantity
            )
            db.add(stock)
    
    import_record.status = "received"
    import_record.arrival_date = date.today()
    
    await db.commit()
    return {"message": "Import received successfully"}


@router.get("/transfers", response_model=List[StockTransferResponse])
async def get_transfers(
    to_branch_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(StockTransfer)
    if to_branch_id:
        query = query.where(StockTransfer.to_branch_id == to_branch_id)
    if status:
        query = query.where(StockTransfer.status == status)
    
    result = await db.execute(query.order_by(StockTransfer.request_date.desc()))
    return result.scalars().all()


@router.post("/transfers", response_model=StockTransferResponse)
async def create_transfer_request(
    transfer_in: StockTransferCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    transfer = StockTransfer(
        from_warehouse_id=transfer_in.from_warehouse_id,
        to_branch_id=transfer_in.to_branch_id,
        requested_by_id=current_user.id,
        notes=transfer_in.notes
    )
    db.add(transfer)
    await db.flush()
    
    for item_in in transfer_in.items:
        item = StockTransferItem(
            transfer_id=transfer.id,
            product_id=item_in.product_id,
            requested_quantity=item_in.requested_quantity
        )
        db.add(item)
    
    await db.commit()
    await db.refresh(transfer)
    return transfer


@router.put("/transfers/{transfer_id}/approve")
async def approve_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    items_result = await db.execute(
        select(StockTransferItem).where(StockTransferItem.transfer_id == transfer_id)
    )
    items = items_result.scalars().all()
    
    for item in items:
        item.approved_quantity = item.requested_quantity
    
    transfer.status = "approved"
    transfer.approved_by_id = current_user.id
    transfer.approved_date = datetime.utcnow()
    
    await db.commit()
    return {"message": "Transfer approved"}


@router.put("/transfers/{transfer_id}/complete")
async def complete_transfer(
    transfer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(StockTransfer).where(StockTransfer.id == transfer_id))
    transfer = result.scalar_one_or_none()
    if not transfer:
        raise HTTPException(status_code=404, detail="Transfer not found")
    
    items_result = await db.execute(
        select(StockTransferItem).where(StockTransferItem.transfer_id == transfer_id)
    )
    items = items_result.scalars().all()
    
    for item in items:
        item.received_quantity = item.approved_quantity or item.requested_quantity
        
        wh_stock_result = await db.execute(
            select(WarehouseStock).where(
                WarehouseStock.warehouse_id == transfer.from_warehouse_id,
                WarehouseStock.product_id == item.product_id
            )
        )
        wh_stock = wh_stock_result.scalar_one_or_none()
        if wh_stock:
            wh_stock.quantity -= item.received_quantity
        
        br_stock_result = await db.execute(
            select(BranchStock).where(
                BranchStock.branch_id == transfer.to_branch_id,
                BranchStock.product_id == item.product_id
            )
        )
        br_stock = br_stock_result.scalar_one_or_none()
        
        if br_stock:
            br_stock.quantity += item.received_quantity
            br_stock.last_restocked = datetime.utcnow()
        else:
            br_stock = BranchStock(
                branch_id=transfer.to_branch_id,
                product_id=item.product_id,
                quantity=item.received_quantity,
                last_restocked=datetime.utcnow()
            )
            db.add(br_stock)
    
    transfer.status = "completed"
    transfer.completed_date = datetime.utcnow()
    
    await db.commit()
    return {"message": "Transfer completed"}


@router.get("/alerts", response_model=List[StockAlertResponse])
async def get_stock_alerts(
    branch_id: Optional[int] = None,
    unresolved_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(StockAlert)
    if branch_id:
        query = query.where(StockAlert.branch_id == branch_id)
    if unresolved_only:
        query = query.where(StockAlert.is_resolved == False)
    
    result = await db.execute(query.order_by(StockAlert.created_at.desc()))
    return result.scalars().all()


@router.get("/vendors")
async def get_vendors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Vendor).order_by(Vendor.name))
    vendors = result.scalars().all()
    return [
        {
            "id": v.id,
            "name": v.name,
            "contact_person": v.contact_person,
            "email": v.email,
            "phone": v.phone,
            "address": v.address,
            "is_active": v.is_active,
            "created_at": v.created_at.isoformat() if v.created_at else None,
        }
        for v in vendors
    ]


@router.post("/vendors")
async def create_vendor(
    vendor_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    vendor = Vendor(
        name=vendor_data.get("name"),
        contact_person=vendor_data.get("contact_person"),
        email=vendor_data.get("email"),
        phone=vendor_data.get("phone"),
        address=vendor_data.get("address"),
        notes=vendor_data.get("notes"),
    )
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return {"id": vendor.id, "name": vendor.name, "message": "Vendor created successfully"}


@router.put("/vendors/{vendor_id}")
async def update_vendor(
    vendor_id: int,
    vendor_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Vendor).where(Vendor.id == vendor_id))
    vendor = result.scalar_one_or_none()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    for key in ["name", "contact_person", "email", "phone", "address", "notes", "is_active"]:
        if key in vendor_data:
            setattr(vendor, key, vendor_data[key])
    
    await db.commit()
    return {"message": "Vendor updated successfully"}


@router.get("/warehouses/{warehouse_id}")
async def get_warehouse(
    warehouse_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Warehouse).where(Warehouse.id == warehouse_id))
    warehouse = result.scalar_one_or_none()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return warehouse


@router.get("/stock-summary")
async def get_all_stock_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get total stock summary for all products across warehouses and branches"""
    from sqlalchemy import func
    from sqlalchemy.orm import selectinload
    from app.models.sales import Product
    
    # Get warehouse stock totals
    wh_result = await db.execute(
        select(
            WarehouseStock.product_id,
            func.sum(WarehouseStock.quantity).label("warehouse_qty")
        ).group_by(WarehouseStock.product_id)
    )
    wh_stock = {row.product_id: row.warehouse_qty for row in wh_result.all()}
    
    # Get branch stock totals
    br_result = await db.execute(
        select(
            BranchStock.product_id,
            func.sum(BranchStock.quantity).label("branch_qty")
        ).group_by(BranchStock.product_id)
    )
    br_stock = {row.product_id: row.branch_qty for row in br_result.all()}
    
    # Get all products
    products_result = await db.execute(
        select(Product).where(Product.is_active == True)
    )
    products = products_result.scalars().all()
    
    return [
        {
            "product_id": p.id,
            "product_name": p.name,
            "sku": p.sku,
            "warehouse_stock": wh_stock.get(p.id, 0),
            "branch_stock": br_stock.get(p.id, 0),
            "total_stock": wh_stock.get(p.id, 0) + br_stock.get(p.id, 0),
        }
        for p in products
    ]


@router.get("/products/{product_id}/stock")
async def get_product_stock_by_branch(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get stock levels for a product across all branches"""
    from sqlalchemy.orm import joinedload
    from app.models.branch import Branch
    
    result = await db.execute(
        select(BranchStock)
        .options(joinedload(BranchStock.branch))
        .where(BranchStock.product_id == product_id)
    )
    stocks = result.unique().scalars().all()
    
    return [
        {
            "id": s.id,
            "branch_id": s.branch_id,
            "branch": {"id": s.branch.id, "name": s.branch.name} if s.branch else None,
            "quantity": s.quantity,
            "min_quantity": s.min_quantity,
            "last_restocked": s.last_restocked.isoformat() if s.last_restocked else None,
        }
        for s in stocks
    ]


@router.get("/products/{product_id}/price-history")
async def get_product_price_history(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get price change history for a product"""
    from sqlalchemy.orm import joinedload
    from app.models.sales import PriceHistory
    
    result = await db.execute(
        select(PriceHistory)
        .options(joinedload(PriceHistory.changed_by))
        .where(PriceHistory.product_id == product_id)
        .order_by(PriceHistory.changed_at.desc())
    )
    history = result.unique().scalars().all()
    
    return [
        {
            "id": h.id,
            "old_price": float(h.old_price) if h.old_price else None,
            "new_price": float(h.new_price) if h.new_price else None,
            "changed_by": {
                "id": h.changed_by.id,
                "first_name": h.changed_by.first_name,
            } if h.changed_by else None,
            "changed_at": h.changed_at.isoformat() if h.changed_at else None,
            "reason": h.reason,
        }
        for h in history
    ]


@router.post("/products/{product_id}/price")
async def update_product_price(
    product_id: int,
    price_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update product price and record in history"""
    from app.models.sales import Product, PriceHistory
    
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    old_price = product.unit_price
    new_price = price_data.get("new_price")
    
    if new_price is None:
        raise HTTPException(status_code=400, detail="New price is required")
    
    history = PriceHistory(
        product_id=product_id,
        old_price=old_price,
        new_price=new_price,
        changed_by_id=current_user.id,
        reason=price_data.get("reason"),
    )
    db.add(history)
    
    product.unit_price = new_price
    
    await db.commit()
    return {"message": "Price updated successfully"}


@router.post("/products/{product_id}/adjust-stock")
async def adjust_product_stock(
    product_id: int,
    adjustment_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Adjust stock quantity for a product with reason tracking"""
    from app.models.sales import Product
    from app.models.inventory import StockAdjustment
    
    quantity_change = adjustment_data.get("quantity_change")
    reason = adjustment_data.get("reason")
    branch_id = adjustment_data.get("branch_id", 1)  # Default to branch 1 for total stock
    
    if quantity_change is None or not reason:
        raise HTTPException(status_code=400, detail="quantity_change and reason are required")
    
    # Get or create branch stock
    result = await db.execute(
        select(BranchStock).where(
            BranchStock.branch_id == branch_id,
            BranchStock.product_id == product_id
        )
    )
    stock = result.scalar_one_or_none()
    
    if not stock:
        stock = BranchStock(
            branch_id=branch_id,
            product_id=product_id,
            quantity=0,
            min_quantity=10
        )
        db.add(stock)
        await db.flush()
    
    old_quantity = stock.quantity
    new_quantity = old_quantity + quantity_change
    
    if new_quantity < 0:
        raise HTTPException(status_code=400, detail=f"Cannot reduce stock below 0. Current: {old_quantity}")
    
    stock.quantity = new_quantity
    
    # Record the adjustment
    adjustment = StockAdjustment(
        product_id=product_id,
        branch_id=branch_id,
        quantity_change=quantity_change,
        old_quantity=old_quantity,
        new_quantity=new_quantity,
        reason=reason,
        adjusted_by_id=current_user.id
    )
    db.add(adjustment)
    
    await db.commit()
    
    return {
        "message": "Stock adjusted successfully",
        "old_quantity": old_quantity,
        "new_quantity": new_quantity,
        "change": quantity_change
    }


@router.get("/products/{product_id}/sales")
async def get_product_sales_summary(
    product_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get sales summary for a product"""
    from sqlalchemy import func
    from app.models.sales import SaleItem, Sale
    
    # Get summary
    result = await db.execute(
        select(
            func.sum(SaleItem.quantity).label("total_quantity"),
            func.sum(SaleItem.total).label("total_revenue")
        ).where(SaleItem.product_id == product_id)
    )
    row = result.first()
    
    # Get recent sales history
    history_result = await db.execute(
        select(SaleItem, Sale)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(SaleItem.product_id == product_id)
        .order_by(Sale.created_at.desc())
        .limit(20)
    )
    history = []
    for sale_item, sale in history_result.all():
        history.append({
            "id": sale_item.id,
            "sale_id": sale.id,
            "receipt_number": sale.receipt_number,
            "quantity": sale_item.quantity,
            "unit_price": float(sale_item.unit_price),
            "total": float(sale_item.total),
            "date": sale.created_at.isoformat() if sale.created_at else None,
            "branch_id": sale.branch_id,
        })
    
    return {
        "total_quantity": row.total_quantity or 0,
        "total_revenue": float(row.total_revenue) if row.total_revenue else 0,
        "history": history,
    }
