"""Branch Assignment endpoints for staff rotation management"""
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, get_current_superuser
from app.models.user import User, BranchAssignment
from app.models.branch import Branch


class BranchAssignmentCreate(BaseModel):
    branch_id: int
    effective_from: datetime
    notes: Optional[str] = None


class BranchAssignmentResponse(BaseModel):
    id: int
    user_id: int
    branch_id: int
    branch_name: str
    assigned_by_id: int
    assigned_by_name: str
    assigned_at: datetime
    effective_from: datetime
    effective_until: Optional[datetime]
    is_current: bool
    verified: bool
    verified_at: Optional[datetime]
    verification_note: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class BranchVerificationRequest(BaseModel):
    confirmed: bool
    note: Optional[str] = None  # Required if confirmed=False


router = APIRouter()


@router.post("/users/{user_id}/assign-branch")
async def assign_branch_to_user(
    user_id: int,
    assignment: BranchAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Admin assigns a new branch to a staff member.
    This creates a history record and sets verification required.
    """
    # Check if current user has admin permissions
    if not current_user.is_superuser:
        # Check for admin permission
        has_permission = False
        if current_user.role and current_user.role.permissions:
            has_permission = any(p.code == "admin.users.manage" for p in current_user.role.permissions)
        if not has_permission:
            raise HTTPException(status_code=403, detail="You don't have permission to assign branches")
    
    # Get the target user
    result = await db.execute(
        select(User).options(joinedload(User.branch)).where(User.id == user_id)
    )
    target_user = result.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get the branch
    result = await db.execute(select(Branch).where(Branch.id == assignment.branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Mark previous assignments as not current
    await db.execute(
        select(BranchAssignment)
        .where(
            BranchAssignment.user_id == user_id,
            BranchAssignment.is_current == True
        )
    )
    result = await db.execute(
        select(BranchAssignment).where(
            BranchAssignment.user_id == user_id,
            BranchAssignment.is_current == True
        )
    )
    current_assignments = result.scalars().all()
    for ca in current_assignments:
        ca.is_current = False
        ca.effective_until = datetime.utcnow()
    
    # Create new assignment record
    new_assignment = BranchAssignment(
        user_id=user_id,
        branch_id=assignment.branch_id,
        assigned_by_id=current_user.id,
        effective_from=assignment.effective_from,
        is_current=True,
        verified=False,
        notes=assignment.notes
    )
    db.add(new_assignment)
    
    # Update user's branch and set verification required
    old_branch_name = target_user.branch.name if target_user.branch else "None"
    target_user.branch_id = assignment.branch_id
    target_user.branch_verification_required = True
    target_user.branch_confirmed_at = None
    
    await db.commit()
    await db.refresh(new_assignment)
    
    return {
        "message": f"Branch assignment updated successfully",
        "assignment": {
            "id": new_assignment.id,
            "user_id": user_id,
            "user_name": f"{target_user.first_name} {target_user.last_name}",
            "old_branch": old_branch_name,
            "new_branch": branch.name,
            "effective_from": assignment.effective_from.isoformat(),
            "verification_required": True
        }
    }


@router.get("/users/{user_id}/branch-history")
async def get_user_branch_history(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get branch assignment history for a user"""
    # Users can view their own history, admins can view anyone's
    if user_id != current_user.id and not current_user.is_superuser:
        has_permission = False
        if current_user.role and current_user.role.permissions:
            has_permission = any(p.code in ["admin.users.view", "admin.users.manage"] for p in current_user.role.permissions)
        if not has_permission:
            raise HTTPException(status_code=403, detail="You don't have permission to view this user's branch history")
    
    result = await db.execute(
        select(BranchAssignment)
        .options(
            joinedload(BranchAssignment.branch),
            joinedload(BranchAssignment.assigned_by)
        )
        .where(BranchAssignment.user_id == user_id)
        .order_by(desc(BranchAssignment.assigned_at))
    )
    assignments = result.unique().scalars().all()
    
    return [
        {
            "id": a.id,
            "branch_id": a.branch_id,
            "branch_name": a.branch.name if a.branch else "Unknown",
            "assigned_by_id": a.assigned_by_id,
            "assigned_by_name": f"{a.assigned_by.first_name} {a.assigned_by.last_name}" if a.assigned_by else "System",
            "assigned_at": a.assigned_at.isoformat() if a.assigned_at else None,
            "effective_from": a.effective_from.isoformat() if a.effective_from else None,
            "effective_until": a.effective_until.isoformat() if a.effective_until else None,
            "is_current": a.is_current,
            "verified": a.verified,
            "verified_at": a.verified_at.isoformat() if a.verified_at else None,
            "verification_note": a.verification_note,
            "notes": a.notes
        }
        for a in assignments
    ]


@router.get("/me/branch-verification-status")
async def get_branch_verification_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if current user needs to verify their branch assignment"""
    if not current_user.branch_verification_required:
        return {
            "verification_required": False
        }
    
    # Get the current assignment
    result = await db.execute(
        select(BranchAssignment)
        .options(joinedload(BranchAssignment.branch), joinedload(BranchAssignment.assigned_by))
        .where(
            BranchAssignment.user_id == current_user.id,
            BranchAssignment.is_current == True
        )
        .order_by(desc(BranchAssignment.assigned_at))
        .limit(1)
    )
    assignment = result.unique().scalar_one_or_none()
    
    if not assignment:
        return {
            "verification_required": False
        }
    
    return {
        "verification_required": True,
        "assignment": {
            "id": assignment.id,
            "branch_id": assignment.branch_id,
            "branch_name": assignment.branch.name if assignment.branch else "Unknown",
            "assigned_by_name": f"{assignment.assigned_by.first_name} {assignment.assigned_by.last_name}" if assignment.assigned_by else "Admin",
            "assigned_at": assignment.assigned_at.isoformat() if assignment.assigned_at else None,
            "effective_from": assignment.effective_from.isoformat() if assignment.effective_from else None,
            "notes": assignment.notes
        }
    }


@router.post("/me/verify-branch")
async def verify_branch_assignment(
    verification: BranchVerificationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    User verifies or reports issue with their branch assignment.
    This is a security measure to ensure staff are at the correct branch.
    """
    # Get current assignment
    result = await db.execute(
        select(BranchAssignment)
        .options(joinedload(BranchAssignment.branch))
        .where(
            BranchAssignment.user_id == current_user.id,
            BranchAssignment.is_current == True
        )
        .order_by(desc(BranchAssignment.assigned_at))
        .limit(1)
    )
    assignment = result.unique().scalar_one_or_none()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="No current branch assignment found")
    
    if verification.confirmed:
        # User confirms they are at the assigned branch
        assignment.verified = True
        assignment.verified_at = datetime.utcnow()
        assignment.verification_note = verification.note
        
        current_user.branch_verification_required = False
        current_user.branch_confirmed_at = datetime.utcnow()
        
        await db.commit()
        
        return {
            "message": "Branch assignment verified successfully",
            "branch_name": assignment.branch.name if assignment.branch else "Unknown",
            "verified_at": assignment.verified_at.isoformat()
        }
    else:
        # User reports they are NOT at the assigned branch
        if not verification.note:
            raise HTTPException(status_code=400, detail="Please provide a reason why you are not at the assigned branch")
        
        assignment.verification_note = f"ISSUE REPORTED: {verification.note}"
        # Don't mark as verified, keep verification_required = True
        # Admin will need to resolve this
        
        await db.commit()
        
        return {
            "message": "Issue reported. Please contact your administrator to resolve the branch assignment.",
            "issue_reported": True,
            "note": verification.note
        }


@router.get("/pending-verifications")
async def get_pending_branch_verifications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Admin: Get list of users with pending branch verifications or reported issues"""
    result = await db.execute(
        select(User)
        .options(joinedload(User.branch))
        .where(User.branch_verification_required == True)
    )
    users = result.unique().scalars().all()
    
    pending = []
    for user in users:
        # Get their current assignment
        assign_result = await db.execute(
            select(BranchAssignment)
            .options(joinedload(BranchAssignment.branch))
            .where(
                BranchAssignment.user_id == user.id,
                BranchAssignment.is_current == True
            )
            .order_by(desc(BranchAssignment.assigned_at))
            .limit(1)
        )
        assignment = assign_result.unique().scalar_one_or_none()
        
        pending.append({
            "user_id": user.id,
            "user_name": f"{user.first_name} {user.last_name}",
            "email": user.email,
            "assigned_branch": assignment.branch.name if assignment and assignment.branch else "Unknown",
            "assigned_at": assignment.assigned_at.isoformat() if assignment else None,
            "has_issue": assignment.verification_note.startswith("ISSUE REPORTED:") if assignment and assignment.verification_note else False,
            "issue_note": assignment.verification_note if assignment and assignment.verification_note else None
        })
    
    return pending
