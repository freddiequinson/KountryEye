from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.api.v1.deps import get_current_active_user, get_current_superuser
from app.models.user import User, Role
from app.schemas.user import UserResponse, UserUpdate, UserCreate


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    # Compute permissions list from role and extra permissions
    permissions = []
    if current_user.role and current_user.role.permissions:
        permissions.extend([p.code for p in current_user.role.permissions])
    if current_user.extra_permissions:
        permissions.extend([p.code for p in current_user.extra_permissions])
    
    # Convert to UserResponse with permissions
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "is_active": current_user.is_active,
        "role_id": current_user.role_id,
        "branch_id": current_user.branch_id,
        "is_superuser": current_user.is_superuser,
        "created_at": current_user.created_at,
        "role": current_user.role,
        "branch": current_user.branch,
        "permissions": list(set(permissions))  # Remove duplicates
    }
    return user_dict


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    
    await db.commit()
    await db.refresh(current_user)
    
    # Load relationships to avoid async lazy loading issues
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch)
        )
        .where(User.id == current_user.id)
    )
    user = result.scalar_one()
    return user


@router.post("/me/change-password")
async def change_password(
    password_data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change current user's password"""
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if len(password_data.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    await db.commit()
    return {"message": "Password changed successfully"}


@router.get("", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """List all users (admin only)"""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch)
        )
        .offset(skip).limit(limit).order_by(User.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=UserResponse)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Create a new user (admin only)"""
    existing = await db.execute(select(User).where(User.email == user_in.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_data = user_in.model_dump(exclude={"password"})
    user = User(
        **user_data,
        hashed_password=get_password_hash(user_in.password)
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Load relationships to avoid async lazy loading issues
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch)
        )
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    return user


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Get a specific user (admin only)"""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Update a user (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    for field, value in user_update.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    # Load relationships to avoid async lazy loading issues
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch)
        )
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    return user


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Deactivate a user (admin only)"""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = False
    await db.commit()
    return {"message": "User deactivated"}


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    password_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser)
):
    """Reset a user's password (admin only)"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_password = password_data.get("password")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    user.hashed_password = get_password_hash(new_password)
    await db.commit()
    return {"message": "Password reset successfully"}


@router.get("/roles/list")
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all available roles"""
    result = await db.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in roles]


@router.get("/me/branches")
async def get_user_branches(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all branches the current user has access to"""
    from app.models.branch import Branch
    
    # If superuser, return all branches
    if current_user.is_superuser:
        result = await db.execute(select(Branch).where(Branch.is_active == True).order_by(Branch.name))
        all_branches = result.scalars().all()
        return [{"id": b.id, "name": b.name, "is_primary": b.id == current_user.branch_id} for b in all_branches]
    
    # Get user's primary branch by querying directly
    branches = []
    if current_user.branch_id:
        branch_result = await db.execute(select(Branch).where(Branch.id == current_user.branch_id))
        primary_branch = branch_result.scalar_one_or_none()
        if primary_branch:
            branches.append({
                "id": primary_branch.id,
                "name": primary_branch.name,
                "is_primary": True
            })
    
    return branches


@router.post("/me/switch-branch/{branch_id}")
async def switch_user_branch(
    branch_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Switch the current user's active branch"""
    from app.models.branch import Branch
    
    # Verify the branch exists
    result = await db.execute(select(Branch).where(Branch.id == branch_id))
    branch = result.scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    
    # Check if user has access to this branch
    has_access = False
    if current_user.is_superuser:
        has_access = True
    elif current_user.branch_id == branch_id:
        has_access = True
    elif hasattr(current_user, 'additional_branches') and current_user.additional_branches:
        has_access = any(b.id == branch_id for b in current_user.additional_branches)
    
    if not has_access:
        raise HTTPException(status_code=403, detail="You don't have access to this branch")
    
    # Update user's current branch
    current_user.branch_id = branch_id
    await db.commit()
    await db.refresh(current_user)
    
    # Return updated user info
    permissions = []
    if current_user.role and current_user.role.permissions:
        permissions.extend([p.code for p in current_user.role.permissions])
    if current_user.extra_permissions:
        permissions.extend([p.code for p in current_user.extra_permissions])
    
    return {
        "message": "Branch switched successfully",
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "first_name": current_user.first_name,
            "last_name": current_user.last_name,
            "phone": current_user.phone,
            "is_active": current_user.is_active,
            "role_id": current_user.role_id,
            "branch_id": current_user.branch_id,
            "is_superuser": current_user.is_superuser,
            "created_at": current_user.created_at,
            "role": {"id": current_user.role.id, "name": current_user.role.name} if current_user.role else None,
            "branch": {"id": branch.id, "name": branch.name},
            "permissions": list(set(permissions))
        }
    }
