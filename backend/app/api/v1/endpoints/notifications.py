from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, update
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.communication import Notification

router = APIRouter()


# ============ SCHEMAS ============

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: Optional[str]
    notification_type: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    action_url: Optional[str]
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ============ ENDPOINTS ============

@router.get("")
async def get_notifications(
    unread_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get notifications for current user"""
    query = select(Notification).where(Notification.user_id == current_user.id)
    
    if unread_only:
        query = query.where(Notification.is_read == False)
    
    query = query.order_by(Notification.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    notifications = result.scalars().all()
    
    return [
        {
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "notification_type": n.notification_type,
            "reference_type": n.reference_type,
            "reference_id": n.reference_id,
            "action_url": n.action_url,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        }
        for n in notifications
    ]


@router.get("/count")
async def get_unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get count of unread notifications"""
    result = await db.execute(
        select(func.count(Notification.id))
        .where(and_(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ))
    )
    count = result.scalar() or 0
    
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_as_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a notification as read"""
    result = await db.execute(
        select(Notification)
        .where(and_(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        ))
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Notification marked as read"}


@router.post("/read-all")
async def mark_all_as_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark all notifications as read"""
    await db.execute(
        update(Notification)
        .where(and_(
            Notification.user_id == current_user.id,
            Notification.is_read == False
        ))
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.commit()
    
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a notification"""
    result = await db.execute(
        select(Notification)
        .where(and_(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        ))
    )
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    await db.delete(notification)
    await db.commit()
    
    return {"message": "Notification deleted"}


@router.delete("/clear-all")
async def clear_all_notifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Clear all notifications for current user"""
    result = await db.execute(
        select(Notification).where(Notification.user_id == current_user.id)
    )
    notifications = result.scalars().all()
    
    for n in notifications:
        await db.delete(n)
    
    await db.commit()
    
    return {"message": "All notifications cleared"}
