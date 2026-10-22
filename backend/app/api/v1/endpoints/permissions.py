from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, require_permission
from app.models.user import User, Role, Permission, UserPermission, UserBranch

router = APIRouter()

PERM_READ = require_permission("permissions.manage", "employees.manage", "employees.view", "analytics.view")


# Pydantic schemas
class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None
    module: Optional[str] = None
    code: Optional[str] = None


class PermissionResponse(PermissionBase):
    id: int

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_page: Optional[str] = "/dashboard"


class RoleCreate(RoleBase):
    permission_ids: List[int] = []


class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_page: Optional[str] = None
    permission_ids: Optional[List[int]] = None


class RoleResponse(RoleBase):
    id: int
    is_system: Optional[bool] = False
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True


class UserPermissionUpdate(BaseModel):
    extra_permission_ids: List[int] = []
    denied_permission_ids: List[int] = []
    additional_branch_ids: List[int] = []



@router.get("/permissions", response_model=List[PermissionResponse])
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PERM_READ)
):
    """Get all permissions"""
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.name))
    return result.scalars().all()


@router.get("/roles", response_model=List[RoleResponse])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PERM_READ)
):
    """Get all roles with their permissions"""
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    )
    return result.scalars().all()


@router.get("/roles/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PERM_READ)
):
    """Get a specific role"""
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.post("/roles", response_model=RoleResponse)
async def create_role(
    role_data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new role"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Check if role exists
    existing = await db.execute(select(Role).where(Role.name == role_data.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Role already exists")
    
    # Get permissions
    permissions = []
    if role_data.permission_ids:
        perm_result = await db.execute(
            select(Permission).where(Permission.id.in_(role_data.permission_ids))
        )
        permissions = perm_result.scalars().all()
    
    role = Role(
        name=role_data.name,
        description=role_data.description,
        default_page=role_data.default_page,
        permissions=permissions
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    return role


@router.put("/roles/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a role"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.execute(
        select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    if role.is_system:
        raise HTTPException(status_code=400, detail="Cannot modify system role")
    
    if role_data.name:
        role.name = role_data.name
    if role_data.description:
        role.description = role_data.description
    if role_data.default_page:
        role.default_page = role_data.default_page
    
    if role_data.permission_ids is not None:
        perm_result = await db.execute(
            select(Permission).where(Permission.id.in_(role_data.permission_ids))
        )
        role.permissions = perm_result.scalars().all()
    
    await db.commit()
    await db.refresh(role)
    return role


@router.put("/users/{user_id}/permissions", response_model=dict)
async def update_user_permissions(
    user_id: int,
    data: UserPermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update user's extra permissions and additional branches"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    from app.models.user import UserDeniedPermission
    
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.extra_permissions), 
            selectinload(User.denied_permissions),
            selectinload(User.additional_branches)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update extra permissions
    if data.extra_permission_ids:
        perm_result = await db.execute(
            select(Permission).where(Permission.id.in_(data.extra_permission_ids))
        )
        user.extra_permissions = perm_result.scalars().all()
    else:
        user.extra_permissions = []
    
    # Update denied permissions
    if data.denied_permission_ids:
        denied_result = await db.execute(
            select(Permission).where(Permission.id.in_(data.denied_permission_ids))
        )
        user.denied_permissions = denied_result.scalars().all()
    else:
        user.denied_permissions = []
    
    # Update additional branches
    from app.models.branch import Branch
    if data.additional_branch_ids:
        branch_result = await db.execute(
            select(Branch).where(Branch.id.in_(data.additional_branch_ids))
        )
        user.additional_branches = branch_result.scalars().all()
    else:
        user.additional_branches = []
    
    await db.commit()
    
    return {"message": "User permissions updated successfully"}


@router.get("/users/{user_id}/effective-permissions")
async def get_user_effective_permissions(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(PERM_READ)
):
    """Get all effective permissions for a user (role + extra permissions)"""
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.extra_permissions),
            selectinload(User.denied_permissions),
            selectinload(User.additional_branches),
            selectinload(User.branch)
        )
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get denied permission IDs
    denied_ids = {p.id for p in user.denied_permissions}
    
    # Combine role permissions and extra permissions, excluding denied ones
    permissions = set()
    if user.role:
        for perm in user.role.permissions:
            if perm.id not in denied_ids:
                permissions.add(perm.code)
    
    for perm in user.extra_permissions:
        permissions.add(perm.code)
    
    # Get accessible branches
    branches = []
    if user.branch:
        branches.append({"id": user.branch.id, "name": user.branch.name, "is_primary": True})
    for branch in user.additional_branches:
        branches.append({"id": branch.id, "name": branch.name, "is_primary": False})
    
    return {
        "user_id": user.id,
        "role": user.role.name if user.role else None,
        "role_id": user.role.id if user.role else None,
        "is_superuser": user.is_superuser,
        "permissions": list(permissions),
        "extra_permission_ids": [p.id for p in user.extra_permissions],
        "denied_permission_ids": [p.id for p in user.denied_permissions],
        "additional_branch_ids": [b.id for b in user.additional_branches],
        "role_permission_ids": [p.id for p in user.role.permissions] if user.role else [],
        "branches": branches,
        "default_page": user.role.default_page if user.role else "/dashboard"
    }


@router.post("/seed-defaults")
async def seed_default_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add any missing default permissions and roles"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    from app.core.rbac import ensure_rbac
    report = await ensure_rbac(db)
    return {
        "message": "Default permissions and roles seeded",
        "permissions_created": len(report["permissions_added"]),
        "roles_created": len(report["roles_added"]),
    }
