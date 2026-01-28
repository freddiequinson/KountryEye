from pydantic import BaseModel
from typing import Optional
from datetime import datetime, time


class BranchBase(BaseModel):
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None


class BranchCreate(BranchBase):
    is_main: bool = False


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    is_active: Optional[bool] = None
    # Geolocation settings
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: Optional[int] = None
    # Work hours settings
    work_start_time: Optional[str] = None  # Format: "HH:MM"
    work_end_time: Optional[str] = None    # Format: "HH:MM"
    late_threshold_minutes: Optional[int] = None
    require_geolocation: Optional[bool] = None


class BranchResponse(BranchBase):
    id: int
    is_active: bool
    is_main: bool
    created_at: datetime
    # Geolocation settings
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    geofence_radius: Optional[int] = None
    # Work hours settings
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    late_threshold_minutes: Optional[int] = None
    require_geolocation: Optional[bool] = None

    class Config:
        from_attributes = True
