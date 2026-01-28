from pydantic import BaseModel, field_validator
from typing import Optional, Any
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

    @field_validator('work_start_time', 'work_end_time', mode='before')
    @classmethod
    def convert_time_to_string(cls, v: Any) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, time):
            return v.strftime("%H:%M")
        if isinstance(v, str):
            return v
        return str(v)

    class Config:
        from_attributes = True
