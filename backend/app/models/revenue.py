from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class RevenueCategory(str, enum.Enum):
    CONSULTATION = "consultation"
    PRESCRIPTION = "prescription"
    SALE = "sale"
    SERVICE = "service"
    OTHER = "other"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    CARD = "card"
    TRANSFER = "transfer"
    INSURANCE = "insurance"
    VISIONCARE = "visioncare"
    MOMO = "momo"


class Revenue(Base):
    __tablename__ = "revenues"

    id = Column(Integer, primary_key=True, index=True)
    category = Column(String(50), default="other")
    description = Column(String(255), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), default="cash")
    reference_type = Column(String(50))  # 'visit', 'prescription', 'sale', 'other'
    reference_id = Column(Integer)  # ID of related record
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
