from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, get_current_superuser
from app.models.user import User
from app.models.branch import Branch, BranchAssignmentHistory
from app.schemas.branch import BranchCreate, BranchUpdate, BranchResponse

router = APIRouter()


@router.get("", response_model=List[BranchResponse])
async def get_branches(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Branch).where(Branch.is_active == True).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.get("/{branch_id}", response_model=BranchResponse)
async def get_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    return branch


@router.post("", response_model=BranchResponse)
async def create_branch(
    branch_in: BranchCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    branch = Branch(**branch_in.model_dump())
    db.add(branch)
    await db.commit()
    await db.refresh(branch)
    return branch


@router.put("/{branch_id}", response_model=BranchResponse)
async def update_branch(
    branch_id: int,
    branch_in: BranchUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    for field, value in branch_in.model_dump(exclude_unset=True).items():
        setattr(branch, field, value)
    
    await db.commit()
    await db.refresh(branch)
    return branch


@router.delete("/{branch_id}")
async def delete_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    branch.is_active = False
    await db.commit()
    return {"message": "Branch deactivated"}


# ============================================
# BRANCH ASSIGNMENT MANAGEMENT
# ============================================

@router.post("/assign-user")
async def assign_user_to_branch(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Assign a user to a branch (admin only). Records history."""
    user_id = data.get("user_id")
    branch_id = data.get("branch_id")
    notes = data.get("notes", "")
    
    if not user_id or not branch_id:
        raise HTTPException(status_code=400, detail="user_id and branch_id required")
    
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get branch
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    previous_branch_id = user.branch_id
    
    # Record history
    history = BranchAssignmentHistory(
        user_id=user_id,
        branch_id=branch_id,
        previous_branch_id=previous_branch_id,
        assigned_by_id=current_user.id,
        notes=notes,
        assigned_at=datetime.utcnow()
    )
    db.add(history)
    
    # Update user's branch
    user.branch_id = branch_id
    user.branch_confirmed_at = None  # Reset confirmation
    
    await db.commit()
    
    return {
        "message": f"User assigned to {branch.name}",
        "user_id": user_id,
        "branch_id": branch_id,
        "previous_branch_id": previous_branch_id
    }


@router.get("/users/{user_id}/assignment-history")
async def get_user_assignment_history(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get branch assignment history for a user"""
    result = await db.execute(
        select(BranchAssignmentHistory)
        .where(BranchAssignmentHistory.user_id == user_id)
        .order_by(desc(BranchAssignmentHistory.assigned_at))
    )
    history = result.scalars().all()
    
    items = []
    for h in history:
        # Get branch names
        branch_result = await db.execute(select(Branch).where(Branch.id == h.branch_id))
        branch = branch_result.scalar_one_or_none()
        
        prev_branch = None
        if h.previous_branch_id:
            prev_result = await db.execute(select(Branch).where(Branch.id == h.previous_branch_id))
            prev_branch = prev_result.scalar_one_or_none()
        
        assigned_by = None
        if h.assigned_by_id:
            by_result = await db.execute(select(User).where(User.id == h.assigned_by_id))
            assigned_by = by_result.scalar_one_or_none()
        
        items.append({
            "id": h.id,
            "branch_id": h.branch_id,
            "branch_name": branch.name if branch else "Unknown",
            "previous_branch_id": h.previous_branch_id,
            "previous_branch_name": prev_branch.name if prev_branch else None,
            "assigned_by_id": h.assigned_by_id,
            "assigned_by_name": f"{assigned_by.first_name} {assigned_by.last_name}" if assigned_by else None,
            "notes": h.notes,
            "assigned_at": h.assigned_at.isoformat() if h.assigned_at else None
        })
    
    return {"items": items, "total": len(items)}


@router.post("/confirm-branch")
async def confirm_branch_assignment(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """User confirms their current branch assignment"""
    current_user.branch_confirmed_at = datetime.utcnow()
    await db.commit()
    
    return {
        "message": "Branch assignment confirmed",
        "branch_id": current_user.branch_id,
        "confirmed_at": current_user.branch_confirmed_at.isoformat()
    }


@router.get("/check-branch-change")
async def check_branch_change(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if user's branch has changed since last confirmation"""
    if not current_user.branch_id:
        return {"needs_confirmation": False, "branch_id": None, "branch_name": None}
    
    # Get current branch
    result = await db.execute(select(Branch).where(Branch.id == current_user.branch_id))
    branch = result.scalar_one_or_none()
    
    # Get latest assignment
    result = await db.execute(
        select(BranchAssignmentHistory)
        .where(BranchAssignmentHistory.user_id == current_user.id)
        .order_by(desc(BranchAssignmentHistory.assigned_at))
        .limit(1)
    )
    latest = result.scalar_one_or_none()
    
    needs_confirmation = False
    if latest:
        # Check if assignment is newer than confirmation
        if not current_user.branch_confirmed_at:
            needs_confirmation = True
        elif latest.assigned_at and latest.assigned_at > current_user.branch_confirmed_at:
            needs_confirmation = True
    
    return {
        "needs_confirmation": needs_confirmation,
        "branch_id": current_user.branch_id,
        "branch_name": branch.name if branch else None,
        "last_confirmed": current_user.branch_confirmed_at.isoformat() if current_user.branch_confirmed_at else None
    }
