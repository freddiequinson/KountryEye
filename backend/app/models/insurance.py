from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class InsuranceCompany(Base):
    """Insurance companies that patients can use for payment"""
    __tablename__ = "insurance_companies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, unique=True)  # Full name e.g., "National Health Insurance Scheme"
    code = Column(String(50), nullable=False, unique=True)  # Short code e.g., "NHIS"
    
    contact_phone = Column(String(20))
    contact_email = Column(String(255))
    address = Column(Text)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    fee_overrides = relationship("InsuranceFeeOverride", back_populates="insurance_company", cascade="all, delete-orphan")


class InsuranceFeeOverride(Base):
    """Custom consultation fees for specific insurance companies"""
    __tablename__ = "insurance_fee_overrides"

    id = Column(Integer, primary_key=True, index=True)
    insurance_company_id = Column(Integer, ForeignKey("insurance_companies.id"), nullable=False)
    consultation_type_id = Column(Integer, ForeignKey("consultation_types.id"), nullable=False)
    
    # Single override fee (applies to all visit types if specific fees not set)
    override_fee = Column(Numeric(10, 2), nullable=True)
    
    # Per visit type fees (takes priority over override_fee if set)
    initial_fee = Column(Numeric(10, 2), nullable=True)
    review_fee = Column(Numeric(10, 2), nullable=True)
    subsequent_fee = Column(Numeric(10, 2), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    insurance_company = relationship("InsuranceCompany", back_populates="fee_overrides")
    consultation_type = relationship("ConsultationType")
