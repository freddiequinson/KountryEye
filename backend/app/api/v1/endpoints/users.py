from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.core.usernames import normalize_username, ensure_username_free
from app.api.v1.deps import get_current_active_user, get_current_superuser, effective_permissions
from app.models.user import User, Role
from app.schemas.user import UserResponse, UserUpdate, UserCreate, UserSelfUpdate


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    permissions = sorted(effective_permissions(current_user))

    # Convert to UserResponse with permissions
    user_dict = {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "phone": current_user.phone,
        "avatar_url": current_user.avatar_url,
        "date_of_birth": current_user.date_of_birth,
        "is_active": current_user.is_active,
        "role_id": current_user.role_id,
        "branch_id": current_user.branch_id,
        "is_superuser": current_user.is_superuser,
        "created_at": current_user.created_at,
        "role": current_user.role,
        "branch": current_user.branch,
        "permissions": permissions,
        "must_change_password": current_user.must_change_password if current_user.must_change_password is not None else False
    }
    return user_dict


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_update: UserSelfUpdate,
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
    
    if len(password_data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    current_user.hashed_password = get_password_hash(password_data.new_password)
    current_user.must_change_password = False
    await db.commit()  # signs the account out everywhere else
    await db.refresh(current_user)
    from app.core.security import create_access_token
    return {"message": "Password changed successfully",
            "access_token": create_access_token(subject=current_user.id, version=current_user.token_version),
            "token_type": "bearer"}


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
    user_data["username"] = normalize_username(user_data.get("username"))
    await ensure_username_free(db, user_data["username"])
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
    
    updates = user_update.model_dump(exclude_unset=True)
    if "username" in updates:
        updates["username"] = normalize_username(updates["username"])
        await ensure_username_free(db, updates["username"], exclude_user_id=user_id)
    if user_id == current_user.id and updates.get("is_active") is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    for field, value in updates.items():
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
    if not new_password or len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
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
    for b in current_user.additional_branches:
        if b.is_active and all(x["id"] != b.id for x in branches):
            branches.append({"id": b.id, "name": b.name, "is_primary": False})

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
    elif current_user.additional_branches:
        has_access = any(b.id == branch_id for b in current_user.additional_branches)
    
    if not has_access:
        raise HTTPException(status_code=403, detail="You don't have access to this branch")
    
    # Update user's current branch
    current_user.branch_id = branch_id
    await db.commit()
    
    permissions = sorted(effective_permissions(current_user))

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
            "permissions": permissions
        }
    }
