from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean, Date
from sqlalchemy.orm import relationship

from app.core.database import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200))
    contact_person = Column(String(100))
    contact_phone = Column(String(20))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    stock = relationship("WarehouseStock", back_populates="warehouse")
    imports = relationship("Import", back_populates="warehouse")


class WarehouseStock(Base):
    __tablename__ = "warehouse_stock"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=0)
    min_quantity = Column(Integer, default=10)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    warehouse = relationship("Warehouse", back_populates="stock")
    product = relationship("Product")


class Vendor(Base):
    __tablename__ = "vendors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(100))
    email = Column(String(255))
    phone = Column(String(20))
    address = Column(Text)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    imports = relationship("Import", back_populates="vendor")


class Import(Base):
    __tablename__ = "imports"

    id = Column(Integer, primary_key=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"), nullable=False)
    vendor_id = Column(Integer, ForeignKey("vendors.id"))
    supplier_name = Column(String(200))
    reference_number = Column(String(100))
    expected_date = Column(Date)
    arrival_date = Column(Date)
    status = Column(String(50), default="pending")
    total_cost = Column(Numeric(12, 2), default=0)
    notes = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    warehouse = relationship("Warehouse", back_populates="imports")
    vendor = relationship("Vendor", back_populates="imports")
    created_by = relationship("User")
    items = relationship("ImportItem", back_populates="import_record")


class ImportItem(Base):
    __tablename__ = "import_items"

    id = Column(Integer, primary_key=True, index=True)
    import_id = Column(Integer, ForeignKey("imports.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    expected_quantity = Column(Integer, nullable=False)
    received_quantity = Column(Integer, default=0)
    unit_cost = Column(Numeric(10, 2))

    import_record = relationship("Import", back_populates="items")
    product = relationship("Product")


class StockTransfer(Base):
    __tablename__ = "stock_transfers"

    id = Column(Integer, primary_key=True, index=True)
    from_warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    to_branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    requested_by_id = Column(Integer, ForeignKey("users.id"))
    approved_by_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String(50), default="pending")
    request_date = Column(DateTime, default=datetime.utcnow)
    approved_date = Column(DateTime)
    completed_date = Column(DateTime)
    notes = Column(Text)

    from_warehouse = relationship("Warehouse", foreign_keys=[from_warehouse_id])
    to_branch = relationship("Branch")
    requested_by = relationship("User", foreign_keys=[requested_by_id])
    approved_by = relationship("User", foreign_keys=[approved_by_id])
    items = relationship("StockTransferItem", back_populates="transfer")


class StockTransferItem(Base):
    __tablename__ = "stock_transfer_items"

    id = Column(Integer, primary_key=True, index=True)
    transfer_id = Column(Integer, ForeignKey("stock_transfers.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    requested_quantity = Column(Integer, nullable=False)
    approved_quantity = Column(Integer)
    received_quantity = Column(Integer)

    transfer = relationship("StockTransfer", back_populates="items")
    product = relationship("Product")


class StockAlert(Base):
    __tablename__ = "stock_alerts"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    alert_type = Column(String(50))
    current_quantity = Column(Integer)
    min_quantity = Column(Integer)
    is_resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime)

    branch = relationship("Branch")
    warehouse = relationship("Warehouse")
    product = relationship("Product")


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id"))
    quantity_change = Column(Integer, nullable=False)
    old_quantity = Column(Integer, nullable=False)
    new_quantity = Column(Integer, nullable=False)
    reason = Column(String(100), nullable=False)
    notes = Column(Text)
    adjusted_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship("Product")
    branch = relationship("Branch")
    warehouse = relationship("Warehouse")
    adjusted_by = relationship("User")
