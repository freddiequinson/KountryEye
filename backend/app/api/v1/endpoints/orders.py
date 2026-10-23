from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.v1.deps import has_permission, get_current_active_user
from app.models.user import User
from app.models.orders import GlassesOrder, OrderStatusHistory

router = APIRouter()


class GlassesOrderCreate(BaseModel):
    patient_id: int
    prescription_id: Optional[int] = None
    visit_id: Optional[int] = None
    lens_type: Optional[str] = None
    lens_material: Optional[str] = None
    lens_coating: Optional[str] = None
    frame_brand: Optional[str] = None
    frame_model: Optional[str] = None
    frame_color: Optional[str] = None
    frame_size: Optional[str] = None
    sphere_od: Optional[str] = None
    cylinder_od: Optional[str] = None
    axis_od: Optional[str] = None
    add_od: Optional[str] = None
    sphere_os: Optional[str] = None
    cylinder_os: Optional[str] = None
    axis_os: Optional[str] = None
    add_os: Optional[str] = None
    pd: Optional[str] = None
    lens_price: float = Field(default=0, ge=0, le=10_000_000, allow_inf_nan=False)
    frame_price: float = Field(default=0, ge=0, le=10_000_000, allow_inf_nan=False)
    deposit_paid: float = Field(default=0, ge=0, le=10_000_000, allow_inf_nan=False)
    expected_date: Optional[date] = None
    notes: Optional[str] = None
    special_instructions: Optional[str] = None


@router.post("/")
async def create_glasses_order(
    data: GlassesOrderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new glasses order"""
    # Generate order number
    today = date.today()
    count_result = await db.execute(
        select(func.count(GlassesOrder.id)).where(
            func.date(GlassesOrder.created_at) == today
        )
    )
    count = count_result.scalar() or 0
    order_number = f"GO-{today.strftime('%Y%m%d')}-{count + 1:04d}"
    
    from decimal import Decimal
    from app.services.billing import money
    total_price = money(data.lens_price) + money(data.frame_price)
    deposit = money(data.deposit_paid)
    if deposit > 0 and not has_permission(current_user, "payments.create"):
        raise HTTPException(status_code=403, detail="You don't have permission to take payments")
    if deposit > total_price:
        raise HTTPException(status_code=400, detail="The deposit can't be more than the order total")
    balance = total_price - deposit
    
    order = GlassesOrder(
        order_number=order_number,
        patient_id=data.patient_id,
        prescription_id=data.prescription_id,
        visit_id=data.visit_id,
        lens_type=data.lens_type,
        lens_material=data.lens_material,
        lens_coating=data.lens_coating,
        frame_brand=data.frame_brand,
        frame_model=data.frame_model,
        frame_color=data.frame_color,
        frame_size=data.frame_size,
        sphere_od=data.sphere_od,
        cylinder_od=data.cylinder_od,
        axis_od=data.axis_od,
        add_od=data.add_od,
        sphere_os=data.sphere_os,
        cylinder_os=data.cylinder_os,
        axis_os=data.axis_os,
        add_os=data.add_os,
        pd=data.pd,
        lens_price=data.lens_price,
        frame_price=data.frame_price,
        total_price=total_price,
        deposit_paid=deposit,
        balance=balance,
        expected_date=data.expected_date,
        notes=data.notes,
        special_instructions=data.special_instructions,
        status="pending",
        branch_id=current_user.branch_id,
        created_by_id=current_user.id
    )
    db.add(order)
    await db.flush()  # gives the order its id for the history row

    # Add initial status history
    history = OrderStatusHistory(
        order_id=order.id,
        status="pending",
        notes="Order created",
        updated_by_id=current_user.id
    )
    db.add(history)
    if deposit > 0:
        # A deposit is money received: record it like any other payment
        from app.models.revenue import Revenue
        db.add(Revenue(category="sale", description=f"Glasses order deposit ({order_number})", amount=deposit,
                       payment_method="cash", reference_type="glasses_order", reference_id=order.id,
                       patient_id=order.patient_id, branch_id=order.branch_id, recorded_by_id=current_user.id))

    await db.commit()
    await db.refresh(order)

    return order


@router.get("/")
async def get_orders(
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all glasses orders with optional filters"""
    query = select(GlassesOrder).options(joinedload(GlassesOrder.patient))
    
    if status:
        query = query.where(GlassesOrder.status == status)
    if patient_id:
        query = query.where(GlassesOrder.patient_id == patient_id)
    if start_date:
        query = query.where(func.date(GlassesOrder.order_date) >= start_date)
    if end_date:
        query = query.where(func.date(GlassesOrder.order_date) <= end_date)
    
    query = query.order_by(GlassesOrder.created_at.desc())
    result = await db.execute(query)
    orders = result.unique().scalars().all()
    
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "patient_id": o.patient_id,
            "patient_name": f"{o.patient.first_name} {o.patient.last_name}" if o.patient else "Unknown",
            "lens_type": o.lens_type,
            "frame_brand": o.frame_brand,
            "frame_model": o.frame_model,
            "total_price": float(o.total_price) if o.total_price else 0,
            "deposit_paid": float(o.deposit_paid) if o.deposit_paid else 0,
            "balance": float(o.balance) if o.balance else 0,
            "status": o.status,
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "expected_date": o.expected_date.isoformat() if o.expected_date else None,
        }
        for o in orders
    ]


@router.get("/pending")
async def get_pending_orders(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get orders that are not yet delivered"""
    query = select(GlassesOrder).options(joinedload(GlassesOrder.patient)).where(
        GlassesOrder.status.in_(["pending", "in_production", "ready"])
    ).order_by(GlassesOrder.expected_date.asc())
    
    result = await db.execute(query)
    orders = result.unique().scalars().all()
    
    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "patient_name": f"{o.patient.first_name} {o.patient.last_name}" if o.patient else "Unknown",
            "patient_phone": o.patient.phone if o.patient else "",
            "lens_type": o.lens_type,
            "frame_brand": o.frame_brand,
            "status": o.status,
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "expected_date": o.expected_date.isoformat() if o.expected_date else None,
            "balance": float(o.balance) if o.balance else 0,
        }
        for o in orders
    ]


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific order with full details"""
    result = await db.execute(
        select(GlassesOrder).options(joinedload(GlassesOrder.patient)).where(GlassesOrder.id == order_id)
    )
    order = result.unique().scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get status history
    history_result = await db.execute(
        select(OrderStatusHistory).where(OrderStatusHistory.order_id == order_id).order_by(OrderStatusHistory.created_at.desc())
    )
    history = history_result.scalars().all()
    
    return {
        "id": order.id,
        "order_number": order.order_number,
        "patient_id": order.patient_id,
        "patient_name": f"{order.patient.first_name} {order.patient.last_name}" if order.patient else "Unknown",
        "patient_phone": order.patient.phone if order.patient else "",
        "lens_type": order.lens_type,
        "lens_material": order.lens_material,
        "lens_coating": order.lens_coating,
        "frame_brand": order.frame_brand,
        "frame_model": order.frame_model,
        "frame_color": order.frame_color,
        "frame_size": order.frame_size,
        "sphere_od": order.sphere_od,
        "cylinder_od": order.cylinder_od,
        "axis_od": order.axis_od,
        "add_od": order.add_od,
        "sphere_os": order.sphere_os,
        "cylinder_os": order.cylinder_os,
        "axis_os": order.axis_os,
        "add_os": order.add_os,
        "pd": order.pd,
        "lens_price": float(order.lens_price) if order.lens_price else 0,
        "frame_price": float(order.frame_price) if order.frame_price else 0,
        "total_price": float(order.total_price) if order.total_price else 0,
        "deposit_paid": float(order.deposit_paid) if order.deposit_paid else 0,
        "balance": float(order.balance) if order.balance else 0,
        "status": order.status,
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "expected_date": order.expected_date.isoformat() if order.expected_date else None,
        "ready_date": order.ready_date.isoformat() if order.ready_date else None,
        "delivery_date": order.delivery_date.isoformat() if order.delivery_date else None,
        "notes": order.notes,
        "special_instructions": order.special_instructions,
        "status_history": [
            {
                "status": h.status,
                "notes": h.notes,
                "created_at": h.created_at.isoformat() if h.created_at else None
            }
            for h in history
        ]
    }


@router.patch("/{order_id}/status")
async def update_order_status(
    order_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update order status"""
    result = await db.execute(select(GlassesOrder).where(GlassesOrder.id == order_id))
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    new_status = data.get("status")
    notes = data.get("notes", "")
    
    if new_status not in ["pending", "in_production", "ready", "delivered", "cancelled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    if order.status in ("delivered", "cancelled"):
        raise HTTPException(status_code=400, detail="This order is closed")
    if new_status == "delivered":
        from app.services.billing import money
        owed = money(order.total_price) - money(order.deposit_paid)
        if owed > 0:
            raise HTTPException(status_code=409, detail=f"GHS {owed:,.2f} is still owed on this order. Take payment first.")

    order.status = new_status
    
    if new_status == "ready":
        order.ready_date = datetime.utcnow()
    elif new_status == "delivered":
        order.delivery_date = datetime.utcnow()
    
    # Add status history
    history = OrderStatusHistory(
        order_id=order.id,
        status=new_status,
        notes=notes,
        updated_by_id=current_user.id
    )
    db.add(history)
    
    await db.commit()
    
    return {"message": "Status updated", "status": new_status}


@router.post("/{order_id}/payment")
async def record_order_payment(
    order_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record a payment for an order"""
    from decimal import Decimal
    from app.models.revenue import Revenue
    
    result = await db.execute(
        select(GlassesOrder).options(joinedload(GlassesOrder.patient)).where(GlassesOrder.id == order_id)
    )
    order = result.unique().scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    from app.services.billing import parse_amount, lock_for_payment, money
    if not has_permission(current_user, "payments.create"):
        raise HTTPException(status_code=403, detail="You don't have permission to take payments")
    await lock_for_payment(db, order)
    if order.status in ("cancelled",):
        raise HTTPException(status_code=400, detail="This order was cancelled")
    owed = money(order.total_price) - money(order.deposit_paid)
    if owed <= 0:
        raise HTTPException(status_code=400, detail="This order is already fully paid")
    amount = min(parse_amount(data.get("amount"), owed), owed)  # anything above the balance is change
    payment_method = str(data.get("payment_method") or "cash")[:50]

    current_paid = order.deposit_paid or Decimal("0")
    new_paid = current_paid + amount
    order.deposit_paid = new_paid
    order.balance = (order.total_price or Decimal("0")) - new_paid
    
    # Record revenue
    patient_name = f"{order.patient.first_name} {order.patient.last_name}" if order.patient else "Unknown"
    revenue = Revenue(
        category="sale",
        description=f"Glasses order payment - {patient_name} ({order.order_number})",
        amount=amount,
        payment_method=payment_method,
        reference_type="glasses_order",
        reference_id=order.id,
        patient_id=order.patient_id,
        branch_id=order.branch_id,
        recorded_by_id=current_user.id
    )
    db.add(revenue)
    
    await db.commit()
    
    return {
        "message": "Payment recorded",
        "total_paid": float(new_paid),
        "balance": float(order.balance)
    }
