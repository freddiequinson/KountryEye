from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date


# Attendance Schemas
class AttendanceBase(BaseModel):
    date: date
    status: Optional[str] = "present"
    notes: Optional[str] = None


class AttendanceClockIn(BaseModel):
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AttendanceClockOut(BaseModel):
    notes: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AttendanceResponse(BaseModel):
    id: int
    user_id: int
    branch_id: Optional[int] = None
    date: date
    clock_in: Optional[datetime] = None
    clock_out: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    clock_in_latitude: Optional[float] = None
    clock_in_longitude: Optional[float] = None
    clock_out_latitude: Optional[float] = None
    clock_out_longitude: Optional[float] = None
    clock_in_within_geofence: Optional[bool] = None
    clock_out_within_geofence: Optional[bool] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Task Schemas
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assigned_to_id: int
    branch_id: Optional[int] = None
    priority: Optional[str] = "medium"
    due_date: Optional[datetime] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    assigned_to_id: int
    assigned_by_id: int
    branch_id: Optional[int] = None
    status: str
    priority: str
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# Activity Log Schemas
class ActivityLogCreate(BaseModel):
    action: str
    module: Optional[str] = None
    description: Optional[str] = None
    extra_data: Optional[str] = None
    page_path: Optional[str] = None


class ActivityLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    module: Optional[str] = None
    description: Optional[str] = None
    page_path: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# Employee Stats
class EmployeeStatsResponse(BaseModel):
    id: int
    user_id: int
    date: date
    page_views: int = 0
    sales_count: int = 0
    sales_amount: int = 0
    patients_added: int = 0
    visits_added: int = 0
    consultations: int = 0
    prescriptions_added: int = 0
    payments_received: int = 0

    class Config:
        from_attributes = True


# Employee Create (extends User creation)
class EmployeeCreate(BaseModel):
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role_id: int
    branch_id: int


class RoleInfo(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class BranchInfo(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class EmployeeResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    is_active: bool
    role_id: Optional[int] = None
    branch_id: Optional[int] = None
    role: Optional[RoleInfo] = None
    branch: Optional[BranchInfo] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
