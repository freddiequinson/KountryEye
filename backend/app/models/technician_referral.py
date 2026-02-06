from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean, Date, JSON, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


class ScanType(str, enum.Enum):
    OCT = "oct"  # Optical Coherence Tomography
    VFT = "vft"  # Visual Field Test
    FUNDUS = "fundus"  # Fundus Photography
    PACHYMETER = "pachymeter"  # Pachymeter


class PaymentType(str, enum.Enum):
    PERCENTAGE = "percentage"
    FIXED = "fixed"


class ReferralStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class ScanStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    REVIEWED = "reviewed"  # Doctor has reviewed


class ReferralDoctor(Base):
    """External referring doctors from other hospitals/clinics"""
    __tablename__ = "referral_doctors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), unique=True, index=True, nullable=False)  # Primary lookup key
    email = Column(String(255))
    clinic_name = Column(String(200))
    clinic_address = Column(Text)
    specialization = Column(String(100))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    referrals = relationship("ExternalReferral", back_populates="referral_doctor")
    payments = relationship("ReferralPayment", back_populates="referral_doctor")
    payment_settings = relationship("ReferralPaymentSetting", back_populates="referral_doctor")


class ExternalReferral(Base):
    """Referral records from external doctors - clients who come directly to technician"""
    __tablename__ = "external_referrals"

    id = Column(Integer, primary_key=True, index=True)
    referral_number = Column(String(20), unique=True, index=True)  # Auto-generated: REF-YYYYMMDD-XXX
    
    # Client info (may or may not become a patient)
    client_name = Column(String(200), nullable=False)
    client_phone = Column(String(20))
    client_email = Column(String(255))
    client_address = Column(Text)
    client_dob = Column(Date)
    client_sex = Column(String(10))
    
    # Link to patient if they become one or already exist
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    
    # Referral source
    referral_doctor_id = Column(Integer, ForeignKey("referral_doctors.id"), nullable=False)
    
    # Who handled this referral
    technician_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    # Referral details
    referral_date = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)  # Why referred
    notes = Column(Text)
    
    # Status tracking
    status = Column(String(20), default="pending")  # pending, in_progress, completed, cancelled
    
    # Service fee (what client paid)
    service_fee = Column(Numeric(10, 2), default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    referral_doctor = relationship("ReferralDoctor", back_populates="referrals")
    patient = relationship("Patient")
    technician = relationship("User", foreign_keys=[technician_user_id])
    branch = relationship("Branch")
    scans = relationship("TechnicianScan", back_populates="external_referral")
    payment = relationship("ReferralPayment", back_populates="external_referral", uselist=False)


class TechnicianScan(Base):
    """Scan results recorded by technicians (OCT, VFT, Fundus, Pachymeter)"""
    __tablename__ = "technician_scans"

    id = Column(Integer, primary_key=True, index=True)
    scan_number = Column(String(20), unique=True, index=True)  # Auto-generated: SCN-YYYYMMDD-XXX
    
    scan_type = Column(String(20), nullable=False)  # oct, vft, fundus, pachymeter
    
    # Can be linked to patient, external referral, or visit
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=True)
    external_referral_id = Column(Integer, ForeignKey("external_referrals.id"), nullable=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), nullable=True)
    
    # Who performed the scan (nullable for scan requests before technician performs)
    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    # Scan details
    scan_date = Column(DateTime, default=datetime.utcnow)
    
    # Results - structured data for each eye
    od_results = Column(JSON, default=dict)  # Right eye results
    os_results = Column(JSON, default=dict)  # Left eye results
    results_summary = Column(Text)  # Overall summary/interpretation
    
    # PDF upload
    pdf_file_path = Column(String(500))
    
    # Additional notes
    notes = Column(Text)
    
    # Status
    status = Column(String(20), default="pending")  # pending, in_progress, completed, reviewed
    
    # Doctor review
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    doctor_notes = Column(Text)
    
    # Requested by doctor (for internal patients)
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    patient = relationship("Patient")
    external_referral = relationship("ExternalReferral", back_populates="scans")
    visit = relationship("Visit")
    consultation = relationship("Consultation")
    performed_by = relationship("User", foreign_keys=[performed_by_id])
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    branch = relationship("Branch")
    payment = relationship("ScanPayment", back_populates="scan", uselist=False)


class ReferralPaymentSetting(Base):
    """Admin settings for referral payment rates"""
    __tablename__ = "referral_payment_settings"

    id = Column(Integer, primary_key=True, index=True)
    
    # Can be specific to a doctor or default (null = default for all)
    referral_doctor_id = Column(Integer, ForeignKey("referral_doctors.id"), nullable=True)
    
    # Payment configuration
    payment_type = Column(String(20), nullable=False)  # percentage or fixed
    rate = Column(Numeric(10, 2), nullable=False)  # Percentage (e.g., 10.00 for 10%) or fixed amount
    
    # Validity
    effective_from = Column(Date, default=date.today)
    effective_to = Column(Date, nullable=True)  # Null = still active
    is_active = Column(Boolean, default=True)
    
    # Audit
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    referral_doctor = relationship("ReferralDoctor", back_populates="payment_settings")
    created_by = relationship("User")


class ScanPricing(Base):
    """Pricing configuration for different scan types"""
    __tablename__ = "scan_pricing"

    id = Column(Integer, primary_key=True, index=True)
    scan_type = Column(String(20), unique=True, nullable=False)  # oct, vft, fundus, pachymeter
    price = Column(Numeric(10, 2), nullable=False)
    description = Column(String(200))
    is_active = Column(Boolean, default=True)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    created_by = relationship("User")


class ScanPayment(Base):
    """Payment tracking for individual scans - separate from main clinic payments"""
    __tablename__ = "scan_payments"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("technician_scans.id"), nullable=False)
    
    # Amount details
    amount = Column(Numeric(10, 2), nullable=False)
    
    # Payment status
    is_paid = Column(Boolean, default=False)
    payment_method = Column(String(50))  # cash, mobile_money, etc.
    payment_date = Column(DateTime, nullable=True)
    
    # If unpaid and linked to a visit, this tracks if it was added to patient deficit
    added_to_deficit = Column(Boolean, default=False)
    deficit_added_at = Column(DateTime, nullable=True)
    
    # Who recorded the payment
    recorded_by_id = Column(Integer, ForeignKey("users.id"))
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    scan = relationship("TechnicianScan", back_populates="payment")
    recorded_by = relationship("User")


class ReferralPayment(Base):
    """Payment records for referral commissions"""
    __tablename__ = "referral_payments"

    id = Column(Integer, primary_key=True, index=True)
    payment_number = Column(String(20), unique=True, index=True)  # Auto-generated: PAY-YYYYMMDD-XXX
    
    # Links
    referral_doctor_id = Column(Integer, ForeignKey("referral_doctors.id"), nullable=False)
    external_referral_id = Column(Integer, ForeignKey("external_referrals.id"), nullable=True)
    
    # Payment details
    service_amount = Column(Numeric(10, 2), default=0)  # Original service fee
    payment_type = Column(String(20))  # percentage or fixed
    payment_rate = Column(Numeric(10, 2))  # Rate used for calculation
    amount = Column(Numeric(10, 2), nullable=False)  # Calculated payment amount
    
    # Payment execution
    is_paid = Column(Boolean, default=False)
    payment_method = Column(String(50))  # cash, bank_transfer, mobile_money, etc.
    payment_date = Column(DateTime, nullable=True)
    reference_number = Column(String(100))  # Transaction reference
    
    # Who made the payment
    paid_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    # Relationships
    referral_doctor = relationship("ReferralDoctor", back_populates="payments")
    external_referral = relationship("ExternalReferral", back_populates="payment")
    paid_by = relationship("User")
