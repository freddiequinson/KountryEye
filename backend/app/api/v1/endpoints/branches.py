from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, get_current_superuser
from app.models.user import User
from app.models.branch import Branch
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
