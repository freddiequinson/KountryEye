from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, desc
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.branch import Branch
from app.models.employee import Attendance, ActivityLog, EmployeeStats
from app.models.communication import FundRequest
from app.models.patient import Visit
from app.models.sales import Sale
from app.models.clinical import Consultation, Prescription

router = APIRouter()


# ============ HELPER FUNCTIONS ============

async def is_admin(db: AsyncSession, user: User) -> bool:
    """Check if user is admin"""
    if user.is_superuser:
        return True
    if user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name.lower() == "admin":
            return True
    return False


# ============ ENDPOINTS ============

@router.get("/{user_id}")
async def get_user_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed user profile - Admin only"""
    # Check if current user is admin
    if not await is_admin(db, current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get role
    role_name = None
    if user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = role_result.scalar_one_or_none()
        if role:
            role_name = role.name
    
    # Get branch
    branch_name = None
    if user.branch_id:
        branch_result = await db.execute(select(Branch).where(Branch.id == user.branch_id))
        branch = branch_result.scalar_one_or_none()
        if branch:
            branch_name = branch.name
    
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "role_id": user.role_id,
        "role_name": role_name,
        "branch_id": user.branch_id,
        "branch_name": branch_name,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "last_login": user.last_login.isoformat() if user.last_login else None
    }


@router.get("/{user_id}/attendance")
async def get_user_attendance(
    user_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user attendance history - Admin only"""
    if not await is_admin(db, current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Default to last 30 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    query = select(Attendance).where(
        and_(
            Attendance.user_id == user_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        )
    ).order_by(desc(Attendance.date)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    records = result.scalars().all()
    
    # Calculate summary
    summary_result = await db.execute(
        select(
            func.count(Attendance.id),
            func.count(func.nullif(Attendance.status != 'present', True)),
            func.count(func.nullif(Attendance.status != 'late', True)),
            func.count(func.nullif(Attendance.status != 'absent', True))
        )
        .where(and_(
            Attendance.user_id == user_id,
            Attendance.date >= start_date,
            Attendance.date <= end_date
        ))
    )
    summary = summary_result.first()
    
    return {
        "records": [
            {
                "id": r.id,
                "date": r.date.isoformat(),
                "clock_in": r.clock_in.isoformat() if r.clock_in else None,
                "clock_out": r.clock_out.isoformat() if r.clock_out else None,
                "status": r.status,
                "notes": r.notes,
                "clock_in_within_geofence": r.clock_in_within_geofence,
                "clock_out_within_geofence": r.clock_out_within_geofence
            }
            for r in records
        ],
        "summary": {
            "total_days": summary[0] or 0,
            "present": summary[1] or 0,
            "late": summary[2] or 0,
            "absent": summary[3] or 0
        },
        "period": {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }
    }


@router.get("/{user_id}/activity")
async def get_user_activity(
    user_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user activity logs - Admin only"""
    if not await is_admin(db, current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Default to last 7 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=7)
    
    query = select(ActivityLog).where(
        and_(
            ActivityLog.user_id == user_id,
            ActivityLog.created_at >= datetime.combine(start_date, datetime.min.time()),
            ActivityLog.created_at <= datetime.combine(end_date, datetime.max.time())
        )
    )
    
    if action:
        query = query.where(ActivityLog.action == action)
    if module:
        query = query.where(ActivityLog.module == module)
    
    query = query.order_by(desc(ActivityLog.created_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "action": log.action,
            "module": log.module,
            "description": log.description,
            "page_path": log.page_path,
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]


@router.get("/{user_id}/stats")
async def get_user_stats(
    user_id: int,
    period: str = Query("month", description="week, month, quarter, year"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user performance statistics - Admin only"""
    if not await is_admin(db, current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Calculate date range
    now = datetime.utcnow()
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    elif period == "quarter":
        start_date = now - timedelta(days=90)
    elif period == "year":
        start_date = now - timedelta(days=365)
    else:
        start_date = now - timedelta(days=30)
    
    # Get visits recorded
    visits_result = await db.execute(
        select(func.count(Visit.id))
        .where(and_(
            Visit.recorded_by_id == user_id,
            Visit.visit_date >= start_date
        ))
    )
    visits_count = visits_result.scalar() or 0
    
    # Get sales made
    sales_result = await db.execute(
        select(func.count(Sale.id), func.sum(Sale.total_amount))
        .where(and_(
            Sale.cashier_id == user_id,
            Sale.created_at >= start_date
        ))
    )
    sales_data = sales_result.first()
    sales_count = sales_data[0] or 0
    sales_amount = float(sales_data[1] or 0)
    
    # Get consultations (if doctor)
    consultations_result = await db.execute(
        select(func.count(Consultation.id))
        .where(and_(
            Consultation.doctor_id == user_id,
            Consultation.created_at >= start_date
        ))
    )
    consultations_count = consultations_result.scalar() or 0
    
    # Get prescriptions written
    prescriptions_result = await db.execute(
        select(func.count(Prescription.id))
        .where(and_(
            Prescription.prescribed_by_id == user_id,
            Prescription.created_at >= start_date
        ))
    )
    prescriptions_count = prescriptions_result.scalar() or 0
    
    # Get fund requests
    fund_requests_result = await db.execute(
        select(
            func.count(FundRequest.id),
            func.sum(FundRequest.amount)
        )
        .where(and_(
            FundRequest.requested_by_id == user_id,
            FundRequest.created_at >= start_date
        ))
    )
    fund_data = fund_requests_result.first()
    fund_requests_count = fund_data[0] or 0
    fund_requests_amount = float(fund_data[1] or 0)
    
    # Get attendance summary
    attendance_result = await db.execute(
        select(
            func.count(Attendance.id),
            func.count(func.nullif(Attendance.status != 'present', True)),
            func.count(func.nullif(Attendance.status != 'late', True)),
            func.count(func.nullif(Attendance.status != 'absent', True))
        )
        .where(and_(
            Attendance.user_id == user_id,
            Attendance.date >= start_date.date()
        ))
    )
    attendance_data = attendance_result.first()
    
    return {
        "period": period,
        "start_date": start_date.isoformat(),
        "end_date": now.isoformat(),
        "visits_recorded": visits_count,
        "sales": {
            "count": sales_count,
            "amount": sales_amount
        },
        "consultations": consultations_count,
        "prescriptions": prescriptions_count,
        "fund_requests": {
            "count": fund_requests_count,
            "amount": fund_requests_amount
        },
        "attendance": {
            "total_days": attendance_data[0] or 0,
            "present": attendance_data[1] or 0,
            "late": attendance_data[2] or 0,
            "absent": attendance_data[3] or 0
        }
    }


@router.get("/{user_id}/fund-requests")
async def get_user_fund_requests(
    user_id: int,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user's fund requests - Admin only"""
    if not await is_admin(db, current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = select(FundRequest).where(FundRequest.requested_by_id == user_id)
    
    if status:
        query = query.where(FundRequest.status == status)
    
    query = query.order_by(desc(FundRequest.created_at)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "title": r.title,
            "description": r.description,
            "amount": float(r.amount),
            "purpose": r.purpose,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
            "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
            "disbursed_at": r.disbursed_at.isoformat() if r.disbursed_at else None,
            "received_at": r.received_at.isoformat() if r.received_at else None
        }
        for r in requests
    ]
