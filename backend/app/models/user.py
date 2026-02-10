from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Table, Text
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base

RolePermission = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)

UserPermission = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)

UserBranch = Table(
    "user_branches",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("branch_id", Integer, ForeignKey("branches.id"), primary_key=True),
)

UserDeniedPermission = Table(
    "user_denied_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True),
)


class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(String(255))
    module = Column(String(50))
    code = Column(String(100), unique=True)  # e.g., "pos.access", "patients.view"
    
    roles = relationship("Role", secondary=RolePermission, back_populates="permissions")
    users = relationship("User", secondary=UserPermission, back_populates="extra_permissions")


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))
    is_system = Column(Boolean, default=False)
    default_page = Column(String(100), default="/dashboard")  # Default landing page for role
    created_at = Column(DateTime, default=datetime.utcnow)
    
    permissions = relationship("Permission", secondary=RolePermission, back_populates="roles")
    users = relationship("User", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    avatar_url = Column(String(500))  # Profile picture URL
    is_active = Column(Boolean, default=True)
    is_superuser = Column(Boolean, default=False)
    
    role_id = Column(Integer, ForeignKey("roles.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"))  # Primary branch
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    branch_confirmed_at = Column(DateTime)  # When user last confirmed their branch assignment
    branch_verification_required = Column(Boolean, default=False)  # True when branch changed by admin
    
    role = relationship("Role", back_populates="users")
    branch = relationship("Branch", back_populates="employees")
    extra_permissions = relationship("Permission", secondary=UserPermission, back_populates="users")
    denied_permissions = relationship("Permission", secondary=UserDeniedPermission)  # Permissions denied from role
    additional_branches = relationship("Branch", secondary=UserBranch)  # Additional branches user can access
    branch_assignments = relationship("BranchAssignment", back_populates="user", foreign_keys="BranchAssignment.user_id")


class BranchAssignment(Base):
    """Track branch assignment history for staff rotation"""
    __tablename__ = "branch_assignments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Admin who made the assignment
    
    assigned_at = Column(DateTime, default=datetime.utcnow)  # When the assignment was made
    effective_from = Column(DateTime, nullable=False)  # When the assignment takes effect
    effective_until = Column(DateTime, nullable=True)  # When assignment ended (null if current)
    
    is_current = Column(Boolean, default=True)  # Is this the current assignment
    verified = Column(Boolean, default=False)  # Has the user verified they are at this branch
    verified_at = Column(DateTime, nullable=True)  # When user verified
    verification_note = Column(Text, nullable=True)  # Note if user reported issue
    
    notes = Column(Text, nullable=True)  # Admin notes for the assignment (reason for rotation)
    
    user = relationship("User", back_populates="branch_assignments", foreign_keys=[user_id])
    branch = relationship("Branch")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])
