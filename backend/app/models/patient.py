from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Text, Enum, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class VisitType(str, enum.Enum):
    INITIAL = "initial"  # First time visit - patient just registered
    REVIEW = "review"  # Return visit within 7 days
    SUBSEQUENT = "subsequent"  # Return visit after 7 days
    FULL_CHECKUP = "full_checkup"  # Legacy - kept for backward compatibility


class Sex(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"


class MaritalStatus(str, enum.Enum):
    SINGLE = "single"
    MARRIED = "married"
    DIVORCED = "divorced"
    WIDOWED = "widowed"


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_number = Column(String(20), unique=True, index=True)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    other_names = Column(String(100))
    
    date_of_birth = Column(Date)
    sex = Column(String(10))
    marital_status = Column(String(20))
    
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(Text)
    occupation = Column(String(100))
    
    emergency_contact_name = Column(String(200))
    emergency_contact_phone = Column(String(20))
    
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    branch = relationship("Branch", back_populates="patients")
    visits = relationship("Visit", back_populates="patient")


class Visit(Base):
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    visit_number = Column(String(20), unique=True, index=True)
    
    visit_type = Column(Enum(VisitType), nullable=False)
    reason = Column(Text)
    notes = Column(Text)
    status = Column(String(20), default="pending_payment")  # pending_payment -> waiting -> in_consultation -> completed
    payment_status = Column(String(20), default="unpaid")  # unpaid, partial, paid
    consultation_fee = Column(Numeric(10, 2), default=0)
    amount_paid = Column(Numeric(10, 2), default=0)
    
    # Payment type: cash, insurance, visioncare
    payment_type = Column(String(20), default="cash")
    # Insurance details
    insurance_provider = Column(String(100))
    insurance_id = Column(String(50))
    insurance_number = Column(String(50))
    insurance_coverage = Column(Numeric(10, 2), default=0)  # Amount covered by insurance
    insurance_limit = Column(Numeric(10, 2), default=0)  # Maximum insurance will cover
    insurance_used = Column(Numeric(10, 2), default=0)  # Amount used from insurance limit
    patient_topup = Column(Numeric(10, 2), default=0)  # Amount patient pays when limit exceeded
    # VisionCare membership
    visioncare_member_id = Column(String(50))
    
    patient_id = Column(Integer, ForeignKey("patients.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    recorded_by_id = Column(Integer, ForeignKey("users.id"))
    consultation_type_id = Column(Integer, ForeignKey("consultation_types.id"))
    
    visit_date = Column(DateTime, default=datetime.utcnow)
    checkout_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    patient = relationship("Patient", back_populates="visits")
    branch = relationship("Branch", back_populates="visits")
    consultations = relationship("Consultation", back_populates="visit")
    consultation_type = relationship("ConsultationType")


class PendingRegistration(Base):
    __tablename__ = "pending_registrations"

    id = Column(Integer, primary_key=True, index=True)
    
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    other_names = Column(String(100))
    
    date_of_birth = Column(Date)
    sex = Column(String(10))
    marital_status = Column(String(20))
    
    phone = Column(String(20))
    email = Column(String(255))
    address = Column(Text)
    nationality = Column(String(100), default="Ghanaian")
    occupation = Column(String(100))
    ghana_card = Column(String(50))
    
    emergency_contact_name = Column(String(200))
    emergency_contact_phone = Column(String(20))
    
    status = Column(String(20), default="pending")
    
    created_at = Column(DateTime, default=datetime.utcnow)
