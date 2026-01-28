from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.revenue import Revenue

router = APIRouter()


class RevenueCreate(BaseModel):
    category: str = "other"
    description: str
    amount: float
    payment_method: str = "cash"
    patient_id: Optional[int] = None
    notes: Optional[str] = None


class RevenueResponse(BaseModel):
    id: int
    category: str
    description: str
    amount: float
    payment_method: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    patient_id: Optional[int]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("")
async def create_revenue(
    data: RevenueCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record other revenue (not from sales)"""
    revenue = Revenue(
        category=data.category,
        description=data.description,
        amount=data.amount,
        payment_method=data.payment_method,
        patient_id=data.patient_id,
        notes=data.notes,
        reference_type="other",
        branch_id=current_user.branch_id,
        recorded_by_id=current_user.id
    )
    db.add(revenue)
    await db.commit()
    await db.refresh(revenue)
    return revenue


def get_date_range(period: str):
    """Get start and end date based on period string"""
    from datetime import timedelta
    today = date.today()
    
    if period == "today":
        return today, today
    elif period == "week":
        # Start from Monday of current week
        start = today - timedelta(days=today.weekday())
        return start, today
    elif period == "month":
        start = today.replace(day=1)
        return start, today
    elif period == "year":
        start = today.replace(month=1, day=1)
        return start, today
    elif period == "all":
        # Return None to get all records
        return None, None
    return None, None


@router.get("")
async def get_revenues(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    category: Optional[str] = None,
    payment_method: Optional[str] = None,
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all revenue records with optional filters"""
    query = select(Revenue)
    
    # Handle period filter
    if period:
        period_start, period_end = get_date_range(period)
        if period_start:
            query = query.where(func.date(Revenue.created_at) >= period_start)
        if period_end:
            query = query.where(func.date(Revenue.created_at) <= period_end)
    else:
        if start_date:
            query = query.where(func.date(Revenue.created_at) >= start_date)
        if end_date:
            query = query.where(func.date(Revenue.created_at) <= end_date)
    
    if category:
        query = query.where(Revenue.category == category)
    if payment_method:
        query = query.where(Revenue.payment_method == payment_method)
    if branch_id:
        query = query.where(Revenue.branch_id == branch_id)
    
    query = query.order_by(Revenue.created_at.desc())
    result = await db.execute(query)
    revenues = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "category": r.category,
            "description": r.description,
            "amount": float(r.amount) if r.amount else 0,
            "payment_method": r.payment_method,
            "reference_type": r.reference_type,
            "reference_id": r.reference_id,
            "patient_id": r.patient_id,
            "notes": r.notes,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in revenues
    ]


@router.get("/summary")
async def get_revenue_summary(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get revenue summary with breakdown by category and payment method"""
    query = select(Revenue)
    
    # Handle period filter
    if period:
        period_start, period_end = get_date_range(period)
        if period_start:
            query = query.where(func.date(Revenue.created_at) >= period_start)
        if period_end:
            query = query.where(func.date(Revenue.created_at) <= period_end)
    else:
        if start_date:
            query = query.where(func.date(Revenue.created_at) >= start_date)
        if end_date:
            query = query.where(func.date(Revenue.created_at) <= end_date)
    
    if branch_id:
        query = query.where(Revenue.branch_id == branch_id)
    
    result = await db.execute(query)
    revenues = result.scalars().all()
    
    # Calculate totals
    total = sum(float(r.amount) for r in revenues)
    
    # By category
    by_category = {}
    for r in revenues:
        cat = r.category or "other"
        by_category[cat] = by_category.get(cat, 0) + float(r.amount)
    
    # By payment method
    by_payment_method = {}
    for r in revenues:
        method = r.payment_method or "cash"
        by_payment_method[method] = by_payment_method.get(method, 0) + float(r.amount)
    
    return {
        "total": total,
        "count": len(revenues),
        "by_category": by_category,
        "by_payment_method": by_payment_method
    }


@router.get("/count")
async def get_revenue_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get total count of revenue records for debugging"""
    result = await db.execute(select(func.count(Revenue.id)))
    count = result.scalar()
    
    # Get a sample record if any exist
    sample = None
    if count > 0:
        sample_result = await db.execute(select(Revenue).limit(1))
        sample_record = sample_result.scalar_one_or_none()
        if sample_record:
            sample = {
                "id": sample_record.id,
                "amount": float(sample_record.amount),
                "category": sample_record.category,
                "created_at": sample_record.created_at.isoformat() if sample_record.created_at else None,
            }
    
    return {
        "total_count": count,
        "sample": sample
    }


@router.get("/today")
async def get_today_revenue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get today's revenue summary"""
    today = date.today()
    
    result = await db.execute(
        select(Revenue).where(func.date(Revenue.created_at) == today)
    )
    revenues = result.scalars().all()
    
    total = sum(float(r.amount) for r in revenues)
    
    by_payment_method = {}
    for r in revenues:
        method = r.payment_method or "cash"
        by_payment_method[method] = by_payment_method.get(method, 0) + float(r.amount)
    
    return {
        "total": total,
        "count": len(revenues),
        "by_payment_method": by_payment_method,
        "records": [
            {
                "id": r.id,
                "category": r.category,
                "description": r.description,
                "amount": float(r.amount),
                "payment_method": r.payment_method,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in revenues
        ]
    }


@router.get("/insurance-breakdown")
async def get_insurance_breakdown(
    period: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get insurance payments breakdown for export"""
    from app.models.patient import Patient, Visit
    
    query = select(Revenue).where(Revenue.payment_method == 'insurance')
    
    # Handle period filter
    if period:
        period_start, period_end = get_date_range(period)
        if period_start:
            query = query.where(func.date(Revenue.created_at) >= period_start)
        if period_end:
            query = query.where(func.date(Revenue.created_at) <= period_end)
    else:
        if start_date:
            query = query.where(func.date(Revenue.created_at) >= start_date)
        if end_date:
            query = query.where(func.date(Revenue.created_at) <= end_date)
    
    result = await db.execute(query.order_by(Revenue.created_at.desc()))
    revenues = result.scalars().all()
    
    # Get patient info for each revenue record
    breakdown = []
    for r in revenues:
        patient_name = "Unknown"
        insurance_provider = "Unknown"
        insurance_id = ""
        
        if r.patient_id:
            patient_result = await db.execute(select(Patient).where(Patient.id == r.patient_id))
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_name = f"{patient.first_name} {patient.last_name}"
        
        # Try to get insurance info from visit if reference_type is visit
        if r.reference_type == 'visit' and r.reference_id:
            visit_result = await db.execute(select(Visit).where(Visit.id == r.reference_id))
            visit = visit_result.scalar_one_or_none()
            if visit:
                insurance_provider = visit.insurance_provider or "Unknown"
                insurance_id = visit.insurance_number or ""
        
        breakdown.append({
            "id": r.id,
            "patient_name": patient_name,
            "insurance_provider": insurance_provider,
            "insurance_id": insurance_id,
            "amount": float(r.amount) if r.amount else 0,
            "description": r.description,
            "date": r.created_at.strftime("%Y-%m-%d") if r.created_at else ""
        })
    
    return breakdown
