from datetime import date, datetime
from typing import Optional, List, Any
from pydantic import BaseModel


class AssetCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_checklist: Optional[List[str]] = None
    default_maintenance_interval: Optional[int] = 90


class AssetCategoryCreate(AssetCategoryBase):
    pass


class AssetCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_checklist: Optional[List[str]] = None
    default_maintenance_interval: Optional[int] = None


class AssetCategoryResponse(AssetCategoryBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BranchSimple(BaseModel):
    id: int
    name: str
    
    class Config:
        from_attributes = True


class AssetBase(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: Optional[int] = None
    branch_id: Optional[int] = None
    serial_number: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    warranty_expiry: Optional[date] = None
    location: Optional[str] = None
    maintenance_interval_days: Optional[int] = None
    maintenance_checklist: Optional[List[str]] = None
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    asset_tag: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    branch_id: Optional[int] = None
    serial_number: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    location: Optional[str] = None
    status: Optional[str] = None
    condition: Optional[str] = None
    maintenance_interval_days: Optional[int] = None
    maintenance_checklist: Optional[List[str]] = None
    notes: Optional[str] = None


class AssetResponse(AssetBase):
    id: int
    asset_tag: str
    status: str
    condition: str
    image_url: Optional[str] = None
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    category: Optional[AssetCategoryResponse] = None
    branch: Optional[BranchSimple] = None

    class Config:
        from_attributes = True


class ChecklistItem(BaseModel):
    item: str
    completed: bool = False


class MaintenanceLogBase(BaseModel):
    maintenance_type: Optional[str] = None
    description: Optional[str] = None
    performed_by: Optional[str] = None
    performed_date: date
    cost: Optional[float] = None
    next_due_date: Optional[date] = None
    checklist_completed: Optional[List[ChecklistItem]] = None
    notes: Optional[str] = None


class MaintenanceLogCreate(MaintenanceLogBase):
    asset_id: int
    fund_request_id: Optional[int] = None  # Link to fund request if paid via fund request


class MaintenanceLogResponse(MaintenanceLogBase):
    id: int
    asset_id: int
    status: str
    fund_request_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MaintenanceReportItem(BaseModel):
    asset_id: int
    asset_tag: str
    asset_name: str
    branch_name: Optional[str] = None
    last_maintenance: Optional[date] = None
    next_maintenance: Optional[date] = None
    days_overdue: Optional[int] = None
    status: str
    condition: str


class TechnicianBase(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    specialization: Optional[str] = None
    notes: Optional[str] = None


class TechnicianCreate(TechnicianBase):
    pass


class TechnicianUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    specialization: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class TechnicianResponse(TechnicianBase):
    id: int
    is_active: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
