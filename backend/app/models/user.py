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
    
    role = relationship("Role", back_populates="users")
    branch = relationship("Branch", back_populates="employees")
    extra_permissions = relationship("Permission", secondary=UserPermission, back_populates="users")
    additional_branches = relationship("Branch", secondary=UserBranch)  # Additional branches user can access
