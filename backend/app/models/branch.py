from sqlalchemy import Column, Integer, String, Boolean, DateTime, Float, Time
from sqlalchemy.orm import relationship
from datetime import datetime, time

from app.core.database import Base


class Branch(Base):
    __tablename__ = "branches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    address = Column(String(255))
    city = Column(String(100))
    phone = Column(String(20))
    email = Column(String(255))
    is_active = Column(Boolean, default=True)
    is_main = Column(Boolean, default=False)
    
    # Geolocation for clock-in/out
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    geofence_radius = Column(Integer, default=100)  # Radius in meters
    
    # Work hours settings
    work_start_time = Column(Time, default=time(8, 0))  # 8:00 AM
    work_end_time = Column(Time, default=time(17, 0))   # 5:00 PM
    late_threshold_minutes = Column(Integer, default=15)  # Minutes after start time to mark as late
    require_geolocation = Column(Boolean, default=False)  # Whether to enforce geolocation for clock-in
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    employees = relationship("User", back_populates="branch")
    visits = relationship("Visit", back_populates="branch")
    patients = relationship("Patient", back_populates="branch")
