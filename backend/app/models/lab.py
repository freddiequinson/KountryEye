"""Glasses jobs for the lab technician, and lens deliveries to the warehouse or a branch."""
from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text

from app.core.database import Base


class LabJob(Base):
    __tablename__ = "lab_jobs"

    id = Column(Integer, primary_key=True)
    job_number = Column(String(30), unique=True, index=True)
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), unique=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    pickup_branch_id = Column(Integer, ForeignKey("branches.id"))
    # received -> in_progress -> ready -> collected (or cancelled)
    status = Column(String(20), nullable=False, default="received", index=True)
    estimated_ready_date = Column(Date)
    technician_id = Column(Integer, ForeignKey("users.id"))
    collected_by_id = Column(Integer, ForeignKey("users.id"))
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    started_at = Column(DateTime)
    ready_at = Column(DateTime)
    collected_at = Column(DateTime)
    overdue_notified_at = Column(DateTime)


class LensDelivery(Base):
    __tablename__ = "lens_deliveries"

    id = Column(Integer, primary_key=True)
    delivery_number = Column(String(30), unique=True, index=True)
    technician_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    destination_type = Column(String(20), nullable=False)  # warehouse | branch
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending | confirmed | rejected
    notes = Column(Text)
    reject_reason = Column(String(255))
    confirmed_by_id = Column(Integer, ForeignKey("users.id"))
    confirmed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class LensDeliveryItem(Base):
    __tablename__ = "lens_delivery_items"

    id = Column(Integer, primary_key=True)
    delivery_id = Column(Integer, ForeignKey("lens_deliveries.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
