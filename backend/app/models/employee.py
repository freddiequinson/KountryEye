from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Date, Time, Enum, Float
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class AttendanceStatus(str, enum.Enum):
    present = "present"
    absent = "absent"
    late = "late"
    half_day = "half_day"
    on_leave = "on_leave"


class TaskStatus(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    date = Column(Date, nullable=False, default=date.today)
    clock_in = Column(DateTime)
    clock_out = Column(DateTime)
    status = Column(String(20), default="present")
    notes = Column(Text)
    
    # Geolocation data for clock-in/out
    clock_in_latitude = Column(Float, nullable=True)
    clock_in_longitude = Column(Float, nullable=True)
    clock_out_latitude = Column(Float, nullable=True)
    clock_out_longitude = Column(Float, nullable=True)
    clock_in_within_geofence = Column(Boolean, default=True)
    clock_out_within_geofence = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="attendance_records")
    branch = relationship("Branch")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(100), nullable=False)  # e.g., "page_view", "sale_created", "patient_added"
    module = Column(String(50))  # e.g., "sales", "patients", "inventory"
    description = Column(Text)
    extra_data = Column(Text)  # JSON string for additional data
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    page_path = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="activity_logs")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    
    assigned_to_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    status = Column(String(20), default="pending")
    priority = Column(String(20), default="medium")
    
    due_date = Column(DateTime)
    completed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assigned_to = relationship("User", foreign_keys=[assigned_to_id], backref="assigned_tasks")
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], backref="created_tasks")
    branch = relationship("Branch")


class EmployeeStats(Base):
    """Daily aggregated stats for employees - computed periodically"""
    __tablename__ = "employee_stats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    date = Column(Date, nullable=False)
    
    # Activity counts
    page_views = Column(Integer, default=0)
    sales_count = Column(Integer, default=0)
    sales_amount = Column(Integer, default=0)
    patients_added = Column(Integer, default=0)
    visits_added = Column(Integer, default=0)
    consultations = Column(Integer, default=0)
    prescriptions_added = Column(Integer, default=0)
    payments_received = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", backref="daily_stats")
