from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    is_active: bool = True


class UserCreate(UserBase):
    password: str
    role_id: Optional[int] = None
    branch_id: Optional[int] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role_id: Optional[int] = None
    branch_id: Optional[int] = None


class PermissionInfo(BaseModel):
    id: int
    code: str
    name: str
    
    class Config:
        from_attributes = True


class RoleInfo(BaseModel):
    id: int
    name: str
    default_page: Optional[str] = None
    permissions: List[PermissionInfo] = []
    
    class Config:
        from_attributes = True


class BranchInfo(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: int
    role_id: Optional[int]
    branch_id: Optional[int]
    is_superuser: bool
    created_at: datetime
    role: Optional[RoleInfo] = None
    branch: Optional[BranchInfo] = None
    permissions: List[str] = []

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: Optional[str] = None
