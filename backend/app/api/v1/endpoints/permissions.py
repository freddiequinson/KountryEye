from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role, Permission, UserPermission, UserBranch

router = APIRouter()


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
    is_system: bool
    permissions: List[PermissionResponse] = []

    class Config:
        from_attributes = True


class UserPermissionUpdate(BaseModel):
    extra_permission_ids: List[int] = []
    denied_permission_ids: List[int] = []
    additional_branch_ids: List[int] = []


# Default permissions for the system
DEFAULT_PERMISSIONS = [
    # Dashboard
    {"name": "View Dashboard", "code": "dashboard.view", "module": "dashboard"},
    {"name": "View Admin Dashboard", "code": "dashboard.admin", "module": "dashboard"},
    {"name": "View Doctor Dashboard", "code": "dashboard.doctor", "module": "dashboard"},
    {"name": "View Front Desk Dashboard", "code": "dashboard.frontdesk", "module": "dashboard"},
    {"name": "View Marketing Dashboard", "code": "dashboard.marketing", "module": "dashboard"},
    
    # Patients
    {"name": "View Patients", "code": "patients.view", "module": "patients"},
    {"name": "Create Patients", "code": "patients.create", "module": "patients"},
    {"name": "Edit Patients", "code": "patients.edit", "module": "patients"},
    {"name": "Delete Patients", "code": "patients.delete", "module": "patients"},
    
    # Visits
    {"name": "View Visits", "code": "visits.view", "module": "visits"},
    {"name": "Create Visits", "code": "visits.create", "module": "visits"},
    {"name": "Check-in Patients", "code": "visits.checkin", "module": "visits"},
    
    # Clinical
    {"name": "View Consultations", "code": "clinical.view", "module": "clinical"},
    {"name": "Create Consultations", "code": "clinical.create", "module": "clinical"},
    {"name": "View Prescriptions", "code": "prescriptions.view", "module": "clinical"},
    {"name": "Create Prescriptions", "code": "prescriptions.create", "module": "clinical"},
    {"name": "Access Doctor Queue", "code": "clinical.queue", "module": "clinical"},
    
    # Sales & POS
    {"name": "Access POS", "code": "pos.access", "module": "sales"},
    {"name": "View Sales", "code": "sales.view", "module": "sales"},
    {"name": "Create Sales", "code": "sales.create", "module": "sales"},
    {"name": "Apply Discounts", "code": "sales.discount", "module": "sales"},
    {"name": "Process Refunds", "code": "sales.refund", "module": "sales"},
    
    # Payments
    {"name": "View Payments", "code": "payments.view", "module": "payments"},
    {"name": "Process Payments", "code": "payments.create", "module": "payments"},
    {"name": "Generate Receipts", "code": "receipts.generate", "module": "payments"},
    
    # Inventory
    {"name": "View Inventory", "code": "inventory.view", "module": "inventory"},
    {"name": "Manage Inventory", "code": "inventory.manage", "module": "inventory"},
    {"name": "View Warehouse", "code": "warehouse.view", "module": "inventory"},
    {"name": "Manage Warehouse", "code": "warehouse.manage", "module": "inventory"},
    {"name": "Transfer Stock", "code": "inventory.transfer", "module": "inventory"},
    
    # Assets
    {"name": "View Assets", "code": "assets.view", "module": "assets"},
    {"name": "Manage Assets", "code": "assets.manage", "module": "assets"},
    
    # Marketing
    {"name": "View Marketing", "code": "marketing.view", "module": "marketing"},
    {"name": "Manage Events", "code": "marketing.events", "module": "marketing"},
    {"name": "View Ratings", "code": "marketing.ratings", "module": "marketing"},
    
    # Employees
    {"name": "View Employees", "code": "employees.view", "module": "employees"},
    {"name": "Manage Employees", "code": "employees.manage", "module": "employees"},
    {"name": "Assign Tasks", "code": "employees.tasks", "module": "employees"},
    
    # Branches
    {"name": "View Branches", "code": "branches.view", "module": "branches"},
    {"name": "Manage Branches", "code": "branches.manage", "module": "branches"},
    
    # Settings & Admin
    {"name": "View Settings", "code": "settings.view", "module": "settings"},
    {"name": "Manage Settings", "code": "settings.manage", "module": "settings"},
    {"name": "Manage Roles", "code": "roles.manage", "module": "settings"},
    {"name": "Manage Permissions", "code": "permissions.manage", "module": "settings"},
    
    # Revenue & Accounting
    {"name": "View Revenue", "code": "revenue.view", "module": "accounting"},
    {"name": "View Accounting", "code": "accounting.view", "module": "accounting"},
    {"name": "Manage Accounting", "code": "accounting.manage", "module": "accounting"},
    
    # Attendance
    {"name": "Clock In/Out", "code": "attendance.clock", "module": "attendance"},
    {"name": "View Own Attendance", "code": "attendance.view_own", "module": "attendance"},
    {"name": "View All Attendance", "code": "attendance.view_all", "module": "attendance"},
    {"name": "Manage Attendance", "code": "attendance.manage", "module": "attendance"},
    
    # Analytics
    {"name": "View Analytics", "code": "analytics.view", "module": "analytics"},
    
    # Fund Requests
    {"name": "View Fund Requests", "code": "fund_requests.view", "module": "fund_requests"},
    {"name": "Create Fund Requests", "code": "fund_requests.create", "module": "fund_requests"},
    {"name": "Approve Fund Requests", "code": "fund_requests.approve", "module": "fund_requests"},
    
    # Messaging
    {"name": "View Messages", "code": "messages.view", "module": "messaging"},
    {"name": "Send Messages", "code": "messages.send", "module": "messaging"},
]

# Default roles with their permissions
DEFAULT_ROLES = {
    "Admin": {
        "description": "Full system access",
        "default_page": "/dashboard",
        "permissions": ["*"],  # All permissions
    },
    "Doctor": {
        "description": "Clinical staff with patient care access",
        "default_page": "/dashboard/doctor",
        "permissions": [
            "dashboard.view", "dashboard.doctor",
            "patients.view", "patients.edit",
            "visits.view",
            "clinical.view", "clinical.create", "clinical.queue",
            "prescriptions.view", "prescriptions.create",
            "pos.access", "sales.view", "sales.create",
            "payments.view", "receipts.generate",
            "attendance.clock", "attendance.view_own",
            "fund_requests.view", "fund_requests.create",
            "messages.view", "messages.send",
        ],
    },
    "Front Desk": {
        "description": "Reception and patient check-in",
        "default_page": "/frontdesk",
        "permissions": [
            "dashboard.view", "dashboard.frontdesk",
            "patients.view", "patients.create", "patients.edit",
            "visits.view", "visits.create", "visits.checkin",
            "pos.access", "sales.view", "sales.create",
            "payments.view", "payments.create", "receipts.generate",
            "attendance.clock", "attendance.view_own",
            "fund_requests.view", "fund_requests.create",
            "messages.view", "messages.send",
        ],
    },
    "Marketing": {
        "description": "Marketing and outreach management",
        "default_page": "/dashboard/marketing",
        "permissions": [
            "dashboard.view", "dashboard.marketing",
            "marketing.view", "marketing.events", "marketing.ratings",
            "patients.view",
            "attendance.clock", "attendance.view_own",
            "fund_requests.view", "fund_requests.create",
            "messages.view", "messages.send",
        ],
    },
}


@router.get("/permissions", response_model=List[PermissionResponse])
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all permissions"""
    result = await db.execute(select(Permission).order_by(Permission.module, Permission.name))
    return result.scalars().all()


@router.get("/roles", response_model=List[RoleResponse])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
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
    current_user: User = Depends(get_current_active_user)
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
    current_user: User = Depends(get_current_active_user)
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
    """Seed default permissions and roles"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    created_permissions = 0
    created_roles = 0
    
    # Create permissions
    for perm_data in DEFAULT_PERMISSIONS:
        existing = await db.execute(
            select(Permission).where(Permission.code == perm_data["code"])
        )
        if not existing.scalar_one_or_none():
            perm = Permission(**perm_data)
            db.add(perm)
            created_permissions += 1
    
    await db.commit()
    
    # Get all permissions for role assignment
    all_perms_result = await db.execute(select(Permission))
    all_permissions = {p.code: p for p in all_perms_result.scalars().all()}
    
    # Create roles
    for role_name, role_data in DEFAULT_ROLES.items():
        existing = await db.execute(select(Role).where(Role.name == role_name))
        if not existing.scalar_one_or_none():
            permissions = []
            if role_data["permissions"] == ["*"]:
                permissions = list(all_permissions.values())
            else:
                for perm_code in role_data["permissions"]:
                    if perm_code in all_permissions:
                        permissions.append(all_permissions[perm_code])
            
            role = Role(
                name=role_name,
                description=role_data["description"],
                default_page=role_data["default_page"],
                is_system=True,
                permissions=permissions
            )
            db.add(role)
            created_roles += 1
    
    await db.commit()
    
    return {
        "message": "Default permissions and roles seeded",
        "permissions_created": created_permissions,
        "roles_created": created_roles
    }
