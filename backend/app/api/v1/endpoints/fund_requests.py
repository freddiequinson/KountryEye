from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.communication import FundRequest, Notification
from app.models.accounting import Expense, ExpenseCategory
from app.models.branch import Branch

router = APIRouter()


# ============ SCHEMAS ============

class FundRequestCreate(BaseModel):
    title: str
    description: Optional[str] = None
    amount: float
    purpose: Optional[str] = "other"


class FundRequestUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    purpose: Optional[str] = None


class FundRequestReview(BaseModel):
    approved: bool
    review_notes: Optional[str] = None


class FundRequestDisburse(BaseModel):
    disbursement_method: str  # cash, transfer, momo
    disbursement_reference: Optional[str] = None


class FundRequestReceive(BaseModel):
    receipt_notes: Optional[str] = None


class FundRequestResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    amount: float
    purpose: Optional[str]
    status: str
    requested_by_id: int
    requested_by_name: Optional[str] = None
    branch_id: Optional[int]
    branch_name: Optional[str] = None
    reviewed_by_id: Optional[int]
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[datetime]
    review_notes: Optional[str]
    disbursed_at: Optional[datetime]
    disbursement_method: Optional[str]
    disbursement_reference: Optional[str]
    received_at: Optional[datetime]
    receipt_notes: Optional[str]
    expense_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ============ HELPER FUNCTIONS ============

async def create_notification(
    db: AsyncSession,
    user_id: int,
    title: str,
    message: str,
    notification_type: str,
    reference_type: str = None,
    reference_id: int = None,
    action_url: str = None
):
    """Create a notification for a user"""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        reference_type=reference_type,
        reference_id=reference_id,
        action_url=action_url
    )
    db.add(notification)
    return notification


async def get_admin_users(db: AsyncSession) -> List[User]:
    """Get all admin users to notify"""
    result = await db.execute(
        select(User)
        .join(Role, User.role_id == Role.id)
        .where(and_(
            User.is_active == True,
            or_(Role.name == "Admin", User.is_superuser == True)
        ))
    )
    return result.scalars().all()


# ============ ENDPOINTS ============

@router.post("", response_model=FundRequestResponse)
async def create_fund_request(
    data: FundRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new fund request"""
    fund_request = FundRequest(
        title=data.title,
        description=data.description,
        amount=Decimal(str(data.amount)),
        purpose=data.purpose,
        requested_by_id=current_user.id,
        branch_id=current_user.branch_id,
        status="pending"
    )
    db.add(fund_request)
    await db.commit()
    await db.refresh(fund_request)
    
    # Notify all admins
    admins = await get_admin_users(db)
    for admin in admins:
        await create_notification(
            db=db,
            user_id=admin.id,
            title="New Fund Request",
            message=f"{current_user.first_name} {current_user.last_name} requested GH₵{data.amount:.2f} for {data.title}",
            notification_type="fund_request",
            reference_type="fund_request",
            reference_id=fund_request.id,
            action_url=f"/admin/fund-requests/{fund_request.id}"
        )
    await db.commit()
    
    return FundRequestResponse(
        id=fund_request.id,
        title=fund_request.title,
        description=fund_request.description,
        amount=float(fund_request.amount),
        purpose=fund_request.purpose,
        status=fund_request.status,
        requested_by_id=fund_request.requested_by_id,
        requested_by_name=f"{current_user.first_name} {current_user.last_name}",
        branch_id=fund_request.branch_id,
        reviewed_by_id=fund_request.reviewed_by_id,
        reviewed_at=fund_request.reviewed_at,
        review_notes=fund_request.review_notes,
        disbursed_at=fund_request.disbursed_at,
        disbursement_method=fund_request.disbursement_method,
        disbursement_reference=fund_request.disbursement_reference,
        received_at=fund_request.received_at,
        receipt_notes=fund_request.receipt_notes,
        expense_id=fund_request.expense_id,
        created_at=fund_request.created_at,
        updated_at=fund_request.updated_at
    )


@router.get("")
async def get_fund_requests(
    status: Optional[str] = None,
    my_requests: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get fund requests - admins see all, employees see their own"""
    # Check if user is admin
    is_admin = current_user.is_superuser
    if current_user.role:
        role_result = await db.execute(
            select(Role).where(Role.id == current_user.role_id)
        )
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    # Build query
    query = select(FundRequest)
    
    if my_requests or not is_admin:
        # Show only user's own requests
        query = query.where(FundRequest.requested_by_id == current_user.id)
    
    if status:
        query = query.where(FundRequest.status == status)
    
    query = query.order_by(FundRequest.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    requests = result.scalars().all()
    
    # Get user and branch info
    response = []
    for req in requests:
        # Get requester info
        requester_result = await db.execute(select(User).where(User.id == req.requested_by_id))
        requester = requester_result.scalar_one_or_none()
        
        # Get reviewer info
        reviewer_name = None
        if req.reviewed_by_id:
            reviewer_result = await db.execute(select(User).where(User.id == req.reviewed_by_id))
            reviewer = reviewer_result.scalar_one_or_none()
            if reviewer:
                reviewer_name = f"{reviewer.first_name} {reviewer.last_name}"
        
        # Get branch info
        branch_name = None
        if req.branch_id:
            branch_result = await db.execute(select(Branch).where(Branch.id == req.branch_id))
            branch = branch_result.scalar_one_or_none()
            if branch:
                branch_name = branch.name
        
        response.append({
            "id": req.id,
            "title": req.title,
            "description": req.description,
            "amount": float(req.amount),
            "purpose": req.purpose,
            "status": req.status,
            "requested_by_id": req.requested_by_id,
            "requested_by_name": f"{requester.first_name} {requester.last_name}" if requester else None,
            "branch_id": req.branch_id,
            "branch_name": branch_name,
            "reviewed_by_id": req.reviewed_by_id,
            "reviewed_by_name": reviewer_name,
            "reviewed_at": req.reviewed_at,
            "review_notes": req.review_notes,
            "disbursed_at": req.disbursed_at,
            "disbursement_method": req.disbursement_method,
            "disbursement_reference": req.disbursement_reference,
            "received_at": req.received_at,
            "receipt_notes": req.receipt_notes,
            "expense_id": req.expense_id,
            "created_at": req.created_at,
            "updated_at": req.updated_at
        })
    
    return response


@router.get("/{request_id}")
async def get_fund_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific fund request"""
    result = await db.execute(
        select(FundRequest).where(FundRequest.id == request_id)
    )
    fund_request = result.scalar_one_or_none()
    
    if not fund_request:
        raise HTTPException(status_code=404, detail="Fund request not found")
    
    # Check access - admins can see all, others only their own
    is_admin = current_user.is_superuser
    if current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if not is_admin and fund_request.requested_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get related info
    requester_result = await db.execute(select(User).where(User.id == fund_request.requested_by_id))
    requester = requester_result.scalar_one_or_none()
    
    reviewer_name = None
    if fund_request.reviewed_by_id:
        reviewer_result = await db.execute(select(User).where(User.id == fund_request.reviewed_by_id))
        reviewer = reviewer_result.scalar_one_or_none()
        if reviewer:
            reviewer_name = f"{reviewer.first_name} {reviewer.last_name}"
    
    branch_name = None
    if fund_request.branch_id:
        branch_result = await db.execute(select(Branch).where(Branch.id == fund_request.branch_id))
        branch = branch_result.scalar_one_or_none()
        if branch:
            branch_name = branch.name
    
    return {
        "id": fund_request.id,
        "title": fund_request.title,
        "description": fund_request.description,
        "amount": float(fund_request.amount),
        "purpose": fund_request.purpose,
        "status": fund_request.status,
        "requested_by_id": fund_request.requested_by_id,
        "requested_by_name": f"{requester.first_name} {requester.last_name}" if requester else None,
        "branch_id": fund_request.branch_id,
        "branch_name": branch_name,
        "reviewed_by_id": fund_request.reviewed_by_id,
        "reviewed_by_name": reviewer_name,
        "reviewed_at": fund_request.reviewed_at,
        "review_notes": fund_request.review_notes,
        "disbursed_at": fund_request.disbursed_at,
        "disbursement_method": fund_request.disbursement_method,
        "disbursement_reference": fund_request.disbursement_reference,
        "received_at": fund_request.received_at,
        "receipt_notes": fund_request.receipt_notes,
        "expense_id": fund_request.expense_id,
        "created_at": fund_request.created_at,
        "updated_at": fund_request.updated_at
    }


@router.post("/{request_id}/review")
async def review_fund_request(
    request_id: int,
    data: FundRequestReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Admin approves or rejects a fund request"""
    # Check if user is admin
    is_admin = current_user.is_superuser
    if current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can review fund requests")
    
    result = await db.execute(
        select(FundRequest).where(FundRequest.id == request_id)
    )
    fund_request = result.scalar_one_or_none()
    
    if not fund_request:
        raise HTTPException(status_code=404, detail="Fund request not found")
    
    if fund_request.status != "pending":
        raise HTTPException(status_code=400, detail="Can only review pending requests")
    
    # Update status
    fund_request.status = "approved" if data.approved else "rejected"
    fund_request.reviewed_by_id = current_user.id
    fund_request.reviewed_at = datetime.utcnow()
    fund_request.review_notes = data.review_notes
    
    # Notify requester
    await create_notification(
        db=db,
        user_id=fund_request.requested_by_id,
        title=f"Fund Request {'Approved' if data.approved else 'Rejected'}",
        message=f"Your request for GH₵{float(fund_request.amount):.2f} ({fund_request.title}) has been {'approved' if data.approved else 'rejected'}",
        notification_type="fund_approved" if data.approved else "fund_rejected",
        reference_type="fund_request",
        reference_id=fund_request.id,
        action_url=f"/fund-requests/{fund_request.id}"
    )
    
    await db.commit()
    
    return {"message": f"Fund request {'approved' if data.approved else 'rejected'}", "status": fund_request.status}


@router.post("/{request_id}/disburse")
async def disburse_fund_request(
    request_id: int,
    data: FundRequestDisburse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Admin marks funds as disbursed"""
    # Check if user is admin
    is_admin = current_user.is_superuser
    if current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can disburse funds")
    
    result = await db.execute(
        select(FundRequest).where(FundRequest.id == request_id)
    )
    fund_request = result.scalar_one_or_none()
    
    if not fund_request:
        raise HTTPException(status_code=404, detail="Fund request not found")
    
    if fund_request.status != "approved":
        raise HTTPException(status_code=400, detail="Can only disburse approved requests")
    
    # Update status
    fund_request.status = "disbursed"
    fund_request.disbursed_at = datetime.utcnow()
    fund_request.disbursement_method = data.disbursement_method
    fund_request.disbursement_reference = data.disbursement_reference
    
    # Notify requester
    await create_notification(
        db=db,
        user_id=fund_request.requested_by_id,
        title="Funds Disbursed",
        message=f"GH₵{float(fund_request.amount):.2f} for {fund_request.title} has been sent via {data.disbursement_method}. Please confirm receipt.",
        notification_type="fund_disbursed",
        reference_type="fund_request",
        reference_id=fund_request.id,
        action_url=f"/fund-requests/{fund_request.id}"
    )
    
    await db.commit()
    
    return {"message": "Funds marked as disbursed", "status": fund_request.status}


@router.post("/{request_id}/receive")
async def confirm_fund_receipt(
    request_id: int,
    data: FundRequestReceive,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Employee confirms receipt of funds - creates expense record"""
    result = await db.execute(
        select(FundRequest).where(FundRequest.id == request_id)
    )
    fund_request = result.scalar_one_or_none()
    
    if not fund_request:
        raise HTTPException(status_code=404, detail="Fund request not found")
    
    # Only the requester can confirm receipt
    if fund_request.requested_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the requester can confirm receipt")
    
    if fund_request.status != "disbursed":
        raise HTTPException(status_code=400, detail="Can only confirm receipt of disbursed funds")
    
    # Update status
    fund_request.status = "received"
    fund_request.received_at = datetime.utcnow()
    fund_request.receipt_notes = data.receipt_notes
    
    # Create expense record
    # Try to find or create expense category
    category_result = await db.execute(
        select(ExpenseCategory).where(ExpenseCategory.name == "Fund Requests")
    )
    category = category_result.scalar_one_or_none()
    
    if not category:
        category = ExpenseCategory(name="Fund Requests", description="Expenses from approved fund requests")
        db.add(category)
        await db.flush()
    
    expense = Expense(
        branch_id=fund_request.branch_id or 1,  # Default to branch 1 if not set
        category_id=category.id,
        amount=fund_request.amount,
        description=f"Fund Request: {fund_request.title}",
        vendor=f"Employee: {current_user.first_name} {current_user.last_name}",
        reference=f"FR-{fund_request.id}",
        expense_date=date.today(),
        is_approved=True,
        approved_by_id=fund_request.reviewed_by_id,
        approved_at=fund_request.reviewed_at,
        recorded_by_id=current_user.id
    )
    db.add(expense)
    await db.flush()
    
    fund_request.expense_id = expense.id
    
    # Notify admins
    admins = await get_admin_users(db)
    for admin in admins:
        await create_notification(
            db=db,
            user_id=admin.id,
            title="Fund Receipt Confirmed",
            message=f"{current_user.first_name} {current_user.last_name} confirmed receipt of GH₵{float(fund_request.amount):.2f} for {fund_request.title}",
            notification_type="fund_received",
            reference_type="fund_request",
            reference_id=fund_request.id,
            action_url=f"/admin/fund-requests/{fund_request.id}"
        )
    
    await db.commit()
    
    return {
        "message": "Receipt confirmed and expense recorded",
        "status": fund_request.status,
        "expense_id": expense.id
    }


@router.delete("/{request_id}")
async def cancel_fund_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a pending fund request"""
    result = await db.execute(
        select(FundRequest).where(FundRequest.id == request_id)
    )
    fund_request = result.scalar_one_or_none()
    
    if not fund_request:
        raise HTTPException(status_code=404, detail="Fund request not found")
    
    # Only the requester or admin can cancel
    is_admin = current_user.is_superuser
    if current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if not is_admin and fund_request.requested_by_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if fund_request.status not in ["pending", "approved"]:
        raise HTTPException(status_code=400, detail="Can only cancel pending or approved requests")
    
    fund_request.status = "cancelled"
    await db.commit()
    
    return {"message": "Fund request cancelled"}


@router.get("/stats/summary")
async def get_fund_request_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get fund request statistics for dashboard"""
    # Check if user is admin
    is_admin = current_user.is_superuser
    if current_user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
        role = role_result.scalar_one_or_none()
        if role and role.name == "Admin":
            is_admin = True
    
    if is_admin:
        # Admin sees all stats
        pending_result = await db.execute(
            select(func.count(FundRequest.id), func.sum(FundRequest.amount))
            .where(FundRequest.status == "pending")
        )
        pending = pending_result.first()
        
        approved_result = await db.execute(
            select(func.count(FundRequest.id), func.sum(FundRequest.amount))
            .where(FundRequest.status == "approved")
        )
        approved = approved_result.first()
        
        disbursed_result = await db.execute(
            select(func.count(FundRequest.id), func.sum(FundRequest.amount))
            .where(FundRequest.status == "disbursed")
        )
        disbursed = disbursed_result.first()
        
        return {
            "pending": {"count": pending[0] or 0, "amount": float(pending[1] or 0)},
            "approved": {"count": approved[0] or 0, "amount": float(approved[1] or 0)},
            "disbursed": {"count": disbursed[0] or 0, "amount": float(disbursed[1] or 0)},
        }
    else:
        # Employee sees their own stats
        my_pending = await db.execute(
            select(func.count(FundRequest.id))
            .where(and_(
                FundRequest.requested_by_id == current_user.id,
                FundRequest.status == "pending"
            ))
        )
        
        my_disbursed = await db.execute(
            select(func.count(FundRequest.id))
            .where(and_(
                FundRequest.requested_by_id == current_user.id,
                FundRequest.status == "disbursed"
            ))
        )
        
        return {
            "my_pending": my_pending.scalar() or 0,
            "awaiting_receipt": my_disbursed.scalar() or 0,
        }
