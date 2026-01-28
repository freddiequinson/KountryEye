from datetime import datetime
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text, ForeignKey, Boolean, Date
from sqlalchemy.orm import relationship

from app.core.database import Base


class GlassesOrder(Base):
    __tablename__ = "glasses_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)
    visit_id = Column(Integer, ForeignKey("visits.id"), nullable=True)
    
    # Lens details
    lens_type = Column(String(100))  # single vision, bifocal, progressive, etc.
    lens_material = Column(String(100))  # CR39, polycarbonate, high-index, etc.
    lens_coating = Column(String(200))  # anti-reflective, blue light, photochromic, etc.
    
    # Frame details
    frame_brand = Column(String(100))
    frame_model = Column(String(100))
    frame_color = Column(String(50))
    frame_size = Column(String(50))
    
    # Prescription values
    sphere_od = Column(String(20))
    cylinder_od = Column(String(20))
    axis_od = Column(String(20))
    add_od = Column(String(20))
    sphere_os = Column(String(20))
    cylinder_os = Column(String(20))
    axis_os = Column(String(20))
    add_os = Column(String(20))
    pd = Column(String(20))  # Pupillary distance
    
    # Pricing
    lens_price = Column(Numeric(10, 2), default=0)
    frame_price = Column(Numeric(10, 2), default=0)
    total_price = Column(Numeric(10, 2), default=0)
    deposit_paid = Column(Numeric(10, 2), default=0)
    balance = Column(Numeric(10, 2), default=0)
    
    # Status tracking
    status = Column(String(50), default="pending")  # pending, in_production, ready, delivered, cancelled
    
    # Timeline
    order_date = Column(DateTime, default=datetime.utcnow)
    expected_date = Column(Date)
    ready_date = Column(DateTime)
    delivery_date = Column(DateTime)
    
    # Additional info
    notes = Column(Text)
    special_instructions = Column(Text)
    
    # Tracking
    branch_id = Column(Integer, ForeignKey("branches.id"))
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    patient = relationship("Patient", foreign_keys=[patient_id])
    branch = relationship("Branch", foreign_keys=[branch_id])
    created_by = relationship("User", foreign_keys=[created_by_id])


class OrderStatusHistory(Base):
    __tablename__ = "order_status_history"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("glasses_orders.id"), nullable=False)
    status = Column(String(50), nullable=False)
    notes = Column(Text)
    updated_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    order = relationship("GlassesOrder", foreign_keys=[order_id])
    updated_by = relationship("User", foreign_keys=[updated_by_id])
