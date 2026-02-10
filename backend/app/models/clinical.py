from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class ConsultationType(Base):
    __tablename__ = "consultation_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    base_fee = Column(Numeric(10, 2), default=0)  # Default/initial visit fee
    initial_fee = Column(Numeric(10, 2), default=0)  # First time visit fee
    review_fee = Column(Numeric(10, 2), default=0)  # Return within 7 days
    subsequent_fee = Column(Numeric(10, 2), default=0)  # Return after 7 days
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    consultations = relationship("Consultation", back_populates="consultation_type")


class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(Integer, primary_key=True, index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=False)
    consultation_type_id = Column(Integer, ForeignKey("consultation_types.id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    fee = Column(Numeric(10, 2), default=0)
    status = Column(String(50), default="pending")
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    visit = relationship("Visit", back_populates="consultations")
    consultation_type = relationship("ConsultationType", back_populates="consultations")
    doctor = relationship("User")
    clinical_record = relationship("ClinicalRecord", back_populates="consultation", uselist=False)
    prescriptions = relationship("Prescription", back_populates="consultation")


class ClinicalRecord(Base):
    __tablename__ = "clinical_records"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"), unique=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))
    recorded_by_id = Column(Integer, ForeignKey("users.id"))
    
    chief_complaint = Column(Text)
    history_of_present_illness = Column(Text)
    past_ocular_history = Column(Text)
    past_medical_history = Column(Text)
    family_history = Column(Text)
    social_history = Column(Text)
    allergies = Column(Text)
    current_medications = Column(Text)
    
    visual_acuity_od = Column(String(50))
    visual_acuity_os = Column(String(50))
    visual_acuity_ou = Column(String(50))
    pinhole_od = Column(String(50))
    pinhole_os = Column(String(50))
    
    iop_od = Column(String(50))
    iop_os = Column(String(50))
    
    refraction_od_sphere = Column(String(20))
    refraction_od_cylinder = Column(String(20))
    refraction_od_axis = Column(String(20))
    refraction_os_sphere = Column(String(20))
    refraction_os_cylinder = Column(String(20))
    refraction_os_axis = Column(String(20))
    refraction_add = Column(String(20))
    refraction_pd = Column(String(20))
    
    anterior_segment_od = Column(Text)
    anterior_segment_os = Column(Text)
    posterior_segment_od = Column(Text)
    posterior_segment_os = Column(Text)
    retina_od = Column(Text)
    retina_os = Column(Text)
    
    diagnosis = Column(Text)
    differential_diagnosis = Column(Text)
    management_plan = Column(Text)
    
    follow_up_date = Column(DateTime)
    follow_up_notes = Column(Text)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    consultation = relationship("Consultation", back_populates="clinical_record")


class ClinicalRecordHistory(Base):
    """Tracks all changes to clinical records like git commits"""
    __tablename__ = "clinical_record_history"

    id = Column(Integer, primary_key=True, index=True)
    clinical_record_id = Column(Integer, ForeignKey("clinical_records.id"), nullable=False)
    modified_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    action = Column(String(20), nullable=False)  # 'create', 'update', 'add'
    field_name = Column(String(100))  # which field was changed
    old_value = Column(Text)  # previous value
    new_value = Column(Text)  # new value
    change_summary = Column(Text)  # human-readable summary
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    clinical_record = relationship("ClinicalRecord", backref="history")
    modified_by = relationship("User")


class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)
    consultation_id = Column(Integer, ForeignKey("consultations.id"))
    visit_id = Column(Integer, ForeignKey("visits.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))
    prescribed_by_id = Column(Integer, ForeignKey("users.id"))
    prescription_type = Column(String(50))
    total_amount = Column(Numeric(10, 2), default=0)
    status = Column(String(50), default="pending")
    payment_method = Column(String(50))
    paid_at = Column(DateTime)
    
    sphere_od = Column(String(20))
    cylinder_od = Column(String(20))
    axis_od = Column(String(20))
    sphere_os = Column(String(20))
    cylinder_os = Column(String(20))
    axis_os = Column(String(20))
    add_power = Column(String(20))
    pd = Column(String(20))
    
    lens_type = Column(String(100))
    lens_material = Column(String(100))
    lens_coating = Column(String(100))
    frame_type = Column(String(100))
    
    notes = Column(Text)
    is_dispensed = Column(Boolean, default=False)
    dispensed_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    consultation = relationship("Consultation", back_populates="prescriptions")
    patient = relationship("Patient")
    items = relationship("PrescriptionItem", back_populates="prescription")


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id = Column(Integer, primary_key=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"))  # Link to product if from inventory
    item_type = Column(String(50), default="medication")  # medication, spectacle, lens, other
    name = Column(String(200), nullable=False)
    description = Column(Text)
    dosage = Column(String(100))
    duration = Column(String(100))
    quantity = Column(Integer, default=1)
    unit_price = Column(Numeric(10, 2), default=0)
    is_external = Column(Boolean, default=False)  # True if not from our inventory
    was_out_of_stock = Column(Boolean, default=False)  # True if prescribed when out of stock

    prescription = relationship("Prescription", back_populates="items")


class OutOfStockRequest(Base):
    """Tracks prescription requests for items that were out of stock - for analytics"""
    __tablename__ = "out_of_stock_requests"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    product_name = Column(String(200), nullable=False)  # Store name in case product deleted
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))
    prescribed_by_id = Column(Integer, ForeignKey("users.id"))
    quantity_requested = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
    prescription = relationship("Prescription")
    patient = relationship("Patient")
    prescribed_by = relationship("User")
