"""Audit logs endpoint for admin to view system activities"""
from typing import Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.employee import ActivityLog

router = APIRouter()


@router.get("/logs")
async def get_audit_logs(
    user_id: Optional[int] = None,
    role_id: Optional[int] = None,
    action: Optional[str] = None,
    module: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get audit logs with filters. Admin only.
    """
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Default date range: last 30 days
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=30)
    
    # Build query
    query = select(ActivityLog).options(selectinload(ActivityLog.user))
    
    conditions = [
        ActivityLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        ActivityLog.created_at <= datetime.combine(end_date, datetime.max.time()),
    ]
    
    if user_id:
        conditions.append(ActivityLog.user_id == user_id)
    
    if action:
        conditions.append(ActivityLog.action == action)
    
    if module:
        conditions.append(ActivityLog.module == module)
    
    if search:
        conditions.append(
            or_(
                ActivityLog.description.ilike(f"%{search}%"),
                ActivityLog.page_path.ilike(f"%{search}%"),
            )
        )
    
    # Filter by role if specified
    if role_id:
        # Get user IDs with this role
        user_result = await db.execute(
            select(User.id).where(User.role_id == role_id)
        )
        user_ids = [row[0] for row in user_result.fetchall()]
        if user_ids:
            conditions.append(ActivityLog.user_id.in_(user_ids))
        else:
            # No users with this role, return empty
            return {"items": [], "total": 0, "skip": skip, "limit": limit}
    
    query = query.where(and_(*conditions))
    
    # Get total count
    count_query = select(func.count(ActivityLog.id)).where(and_(*conditions))
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated results
    query = query.order_by(desc(ActivityLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "items": [
            {
                "id": log.id,
                "user_id": log.user_id,
                "user_name": f"{log.user.first_name} {log.user.last_name}" if log.user else "Unknown",
                "user_email": log.user.email if log.user else None,
                "action": log.action,
                "module": log.module,
                "description": log.description,
                "page_path": log.page_path,
                "ip_address": log.ip_address,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": total,
        "skip": skip,
        "limit": limit,
        "has_more": skip + len(logs) < total,
    }


@router.get("/logs/summary")
async def get_audit_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get summary statistics for audit logs. Admin only."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not end_date:
        end_date = date.today()
    if not start_date:
        start_date = end_date - timedelta(days=7)
    
    date_filter = and_(
        ActivityLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        ActivityLog.created_at <= datetime.combine(end_date, datetime.max.time()),
    )
    
    # Total activities
    total_result = await db.execute(
        select(func.count(ActivityLog.id)).where(date_filter)
    )
    total_activities = total_result.scalar() or 0
    
    # Activities by action
    action_result = await db.execute(
        select(ActivityLog.action, func.count(ActivityLog.id))
        .where(date_filter)
        .group_by(ActivityLog.action)
        .order_by(desc(func.count(ActivityLog.id)))
        .limit(10)
    )
    by_action = [{"action": row[0], "count": row[1]} for row in action_result.fetchall()]
    
    # Activities by module
    module_result = await db.execute(
        select(ActivityLog.module, func.count(ActivityLog.id))
        .where(date_filter)
        .group_by(ActivityLog.module)
        .order_by(desc(func.count(ActivityLog.id)))
        .limit(10)
    )
    by_module = [{"module": row[0] or "unknown", "count": row[1]} for row in module_result.fetchall()]
    
    # Most active users
    user_result = await db.execute(
        select(ActivityLog.user_id, func.count(ActivityLog.id))
        .where(date_filter)
        .group_by(ActivityLog.user_id)
        .order_by(desc(func.count(ActivityLog.id)))
        .limit(10)
    )
    user_counts = user_result.fetchall()
    
    # Get user names
    active_users = []
    for user_id, count in user_counts:
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        if user:
            active_users.append({
                "user_id": user_id,
                "user_name": f"{user.first_name} {user.last_name}",
                "count": count
            })
    
    return {
        "total_activities": total_activities,
        "by_action": by_action,
        "by_module": by_module,
        "most_active_users": active_users,
        "date_range": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        }
    }


@router.get("/logs/actions")
async def get_available_actions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get list of available action types for filtering"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(ActivityLog.action).distinct().order_by(ActivityLog.action)
    )
    actions = [row[0] for row in result.fetchall() if row[0]]
    return {"actions": actions}


@router.get("/logs/modules")
async def get_available_modules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get list of available modules for filtering"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(
        select(ActivityLog.module).distinct().order_by(ActivityLog.module)
    )
    modules = [row[0] for row in result.fetchall() if row[0]]
    return {"modules": modules}
