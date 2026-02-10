from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class VisitFeeSettings(Base):
    """Settings for visit type fees - initial, review, subsequent"""
    __tablename__ = "visit_fee_settings"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)  # Null = global default
    
    initial_visit_fee = Column(Numeric(10, 2), default=0)  # First time visit
    review_visit_fee = Column(Numeric(10, 2), default=0)  # Return within 7 days
    subsequent_visit_fee = Column(Numeric(10, 2), default=0)  # Return after 7 days
    review_period_days = Column(Integer, default=7)  # Days to consider as review visit
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_id = Column(Integer, ForeignKey("users.id"))
    
    branch = relationship("Branch")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text)
    description = Column(String(255))
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by_id = Column(Integer)


class VisionCareMember(Base):
    __tablename__ = "visioncare_members"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(String(50), unique=True, nullable=False, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    phone = Column(String(20))
    email = Column(String(100))
    company = Column(String(200))
    plan_type = Column(String(50))  # e.g., 'individual', 'family', 'corporate'
    valid_from = Column(DateTime)
    valid_until = Column(DateTime)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
