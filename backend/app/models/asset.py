from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean, Date, JSON
from sqlalchemy.orm import relationship

from app.core.database import Base


class AssetCategory(Base):
    __tablename__ = "asset_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    # Default maintenance checklist items for assets in this category
    default_checklist = Column(JSON, default=list)
    # Default maintenance interval in days
    default_maintenance_interval = Column(Integer, default=90)
    created_at = Column(DateTime, default=datetime.utcnow)

    assets = relationship("Asset", back_populates="category")


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    asset_tag = Column(String(50), unique=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("asset_categories.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    serial_number = Column(String(100))
    model = Column(String(100))
    manufacturer = Column(String(100))
    
    purchase_date = Column(Date)
    purchase_price = Column(Numeric(10, 2))
    warranty_expiry = Column(Date)
    
    # Status: active, faulty, destroyed, under_maintenance
    status = Column(String(50), default="active")
    # Condition: excellent, good, fair, poor
    condition = Column(String(50), default="good")
    location = Column(String(200))
    image_url = Column(String(500))
    
    last_maintenance_date = Column(Date)
    next_maintenance_date = Column(Date)
    maintenance_interval_days = Column(Integer)
    
    # Maintenance checklist items for this asset type
    maintenance_checklist = Column(JSON, default=list)
    
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    category = relationship("AssetCategory", back_populates="assets")
    branch = relationship("Branch")
    maintenance_logs = relationship("MaintenanceLog", back_populates="asset", order_by="desc(MaintenanceLog.performed_date)")


class Technician(Base):
    """Maintenance technicians/personnel"""
    __tablename__ = "technicians"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20))
    email = Column(String(255))
    company = Column(String(200))
    specialization = Column(String(200))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    maintenance_logs = relationship("MaintenanceLog", back_populates="technician")


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    technician_id = Column(Integer, ForeignKey("technicians.id"))
    maintenance_type = Column(String(100))
    description = Column(Text)
    performed_by = Column(String(200))
    performed_date = Column(Date, nullable=False)
    cost = Column(Numeric(10, 2))
    next_due_date = Column(Date)
    status = Column(String(50), default="completed")
    # Checklist items completed during this maintenance (JSON array of {item, completed})
    checklist_completed = Column(JSON, default=list)
    notes = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Link to fund request if maintenance was paid via fund request (prevents double expense)
    fund_request_id = Column(Integer, ForeignKey("fund_requests.id"), nullable=True)

    asset = relationship("Asset", back_populates="maintenance_logs")
    technician = relationship("Technician", back_populates="maintenance_logs")
    created_by = relationship("User")
    fund_request = relationship("FundRequest")
