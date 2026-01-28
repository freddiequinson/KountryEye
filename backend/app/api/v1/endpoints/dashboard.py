from typing import Optional
from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.patient import Patient, Visit
from app.models.sales import Sale
from app.models.clinical import Consultation
from app.models.accounting import Income, Expense
from app.models.revenue import Revenue

router = APIRouter()


@router.get("/overview")
async def get_dashboard_overview(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = date.today()
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)
    
    def apply_branch_filter(query, model):
        if branch_id and hasattr(model, 'branch_id'):
            return query.where(model.branch_id == branch_id)
        return query
    
    patients_today = await db.execute(
        apply_branch_filter(
            select(func.count(Patient.id)).where(func.date(Patient.created_at) == today),
            Patient
        )
    )
    patients_month = await db.execute(
        apply_branch_filter(
            select(func.count(Patient.id)).where(func.date(Patient.created_at) >= month_start),
            Patient
        )
    )
    patients_total = await db.execute(
        apply_branch_filter(select(func.count(Patient.id)), Patient)
    )
    
    visits_today = await db.execute(
        apply_branch_filter(
            select(func.count(Visit.id)).where(func.date(Visit.visit_date) == today),
            Visit
        )
    )
    visits_month = await db.execute(
        apply_branch_filter(
            select(func.count(Visit.id)).where(func.date(Visit.visit_date) >= month_start),
            Visit
        )
    )
    
    sales_today_q = select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
        func.date(Sale.created_at) == today
    )
    sales_month_q = select(func.coalesce(func.sum(Sale.total_amount), 0)).where(
        func.date(Sale.created_at) >= month_start
    )
    
    if branch_id:
        sales_today_q = sales_today_q.where(Sale.branch_id == branch_id)
        sales_month_q = sales_month_q.where(Sale.branch_id == branch_id)
    
    sales_today = await db.execute(sales_today_q)
    sales_month = await db.execute(sales_month_q)
    
    # Count visits waiting for consultation (today)
    pending_consultations = await db.execute(
        apply_branch_filter(
            select(func.count(Visit.id)).where(
                and_(
                    func.date(Visit.visit_date) == today,
                    Visit.status == "waiting"
                )
            ),
            Visit
        )
    )
    
    # Count visits in consultation
    in_consultation = await db.execute(
        apply_branch_filter(
            select(func.count(Visit.id)).where(
                and_(
                    func.date(Visit.visit_date) == today,
                    Visit.status == "in_consultation"
                )
            ),
            Visit
        )
    )
    
    # Get revenue totals (includes consultation fees, sales, other revenue)
    revenue_today_q = select(func.coalesce(func.sum(Revenue.amount), 0)).where(
        func.date(Revenue.created_at) == today
    )
    revenue_month_q = select(func.coalesce(func.sum(Revenue.amount), 0)).where(
        func.date(Revenue.created_at) >= month_start
    )
    
    if branch_id:
        revenue_today_q = revenue_today_q.where(Revenue.branch_id == branch_id)
        revenue_month_q = revenue_month_q.where(Revenue.branch_id == branch_id)
    
    revenue_today = await db.execute(revenue_today_q)
    revenue_month = await db.execute(revenue_month_q)
    
    # Get revenue breakdown by payment method for today
    payment_breakdown_q = select(
        Revenue.payment_method,
        func.sum(Revenue.amount).label('total')
    ).where(
        func.date(Revenue.created_at) == today
    ).group_by(Revenue.payment_method)
    
    if branch_id:
        payment_breakdown_q = payment_breakdown_q.where(Revenue.branch_id == branch_id)
    
    payment_breakdown_result = await db.execute(payment_breakdown_q)
    payment_breakdown = {row[0] or 'cash': float(row[1] or 0) for row in payment_breakdown_result.fetchall()}
    
    return {
        "patients": {
            "today": patients_today.scalar() or 0,
            "month": patients_month.scalar() or 0,
            "total": patients_total.scalar() or 0
        },
        "visits": {
            "today": visits_today.scalar() or 0,
            "month": visits_month.scalar() or 0
        },
        "sales": {
            "today": float(sales_today.scalar() or 0),
            "month": float(sales_month.scalar() or 0)
        },
        "revenue": {
            "today": float(revenue_today.scalar() or 0),
            "month": float(revenue_month.scalar() or 0),
            "by_payment_method": payment_breakdown
        },
        "pending_consultations": pending_consultations.scalar() or 0,
        "in_consultation": in_consultation.scalar() or 0
    }


@router.get("/patients/stats")
async def get_patient_stats(
    branch_id: Optional[int] = None,
    period: str = "month",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = date.today()
    
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today.replace(day=1)
    elif period == "year":
        start_date = today.replace(month=1, day=1)
    else:
        start_date = today - timedelta(days=30)
    
    query = select(
        func.date(Patient.created_at).label("date"),
        func.count(Patient.id).label("count")
    ).where(func.date(Patient.created_at) >= start_date)
    
    if branch_id:
        query = query.where(Patient.branch_id == branch_id)
    
    query = query.group_by(func.date(Patient.created_at)).order_by(func.date(Patient.created_at))
    
    result = await db.execute(query)
    data = result.all()
    
    return {
        "period": period,
        "data": [{"date": str(row.date), "count": row.count} for row in data]
    }


@router.get("/sales/stats")
async def get_sales_stats(
    branch_id: Optional[int] = None,
    period: str = "month",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = date.today()
    
    if period == "week":
        start_date = today - timedelta(days=7)
    elif period == "month":
        start_date = today.replace(day=1)
    elif period == "year":
        start_date = today.replace(month=1, day=1)
    else:
        start_date = today - timedelta(days=30)
    
    query = select(
        func.date(Sale.created_at).label("date"),
        func.count(Sale.id).label("count"),
        func.sum(Sale.total_amount).label("total")
    ).where(func.date(Sale.created_at) >= start_date)
    
    if branch_id:
        query = query.where(Sale.branch_id == branch_id)
    
    query = query.group_by(func.date(Sale.created_at)).order_by(func.date(Sale.created_at))
    
    result = await db.execute(query)
    data = result.all()
    
    return {
        "period": period,
        "data": [
            {"date": str(row.date), "count": row.count, "total": float(row.total or 0)}
            for row in data
        ]
    }


@router.get("/visits/queue")
async def get_visit_queue(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = date.today()
    
    query = select(Visit).where(
        and_(
            func.date(Visit.visit_date) == today,
            Visit.status.in_(["waiting", "in_progress"])
        )
    )
    
    if branch_id:
        query = query.where(Visit.branch_id == branch_id)
    
    query = query.order_by(Visit.visit_date)
    
    result = await db.execute(query)
    visits = result.scalars().all()
    
    return {
        "total_waiting": len([v for v in visits if v.status == "waiting"]),
        "total_in_progress": len([v for v in visits if v.status == "in_progress"]),
        "queue": [
            {
                "id": v.id,
                "patient_id": v.patient_id,
                "visit_type": v.visit_type.value if v.visit_type else None,
                "status": v.status,
                "visit_date": v.visit_date.isoformat()
            }
            for v in visits
        ]
    }
