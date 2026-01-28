from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProductCategory(Base):
    __tablename__ = "product_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    category_type = Column(String(50), default="general")  # medication, optical, general
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("product_categories.id"))
    unit_price = Column(Numeric(10, 2), nullable=False)
    cost_price = Column(Numeric(10, 2))
    is_active = Column(Boolean, default=True)
    requires_prescription = Column(Boolean, default=False)
    image_url = Column(String(500))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    category = relationship("ProductCategory", back_populates="products")
    stock_items = relationship("BranchStock", back_populates="product")
    sale_items = relationship("SaleItem", back_populates="product")
    price_history = relationship("PriceHistory", back_populates="product")


class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    old_price = Column(Numeric(10, 2))
    new_price = Column(Numeric(10, 2), nullable=False)
    changed_by_id = Column(Integer, ForeignKey("users.id"))
    changed_at = Column(DateTime, default=datetime.utcnow)
    reason = Column(Text)

    product = relationship("Product", back_populates="price_history")
    changed_by = relationship("User")


class BranchStock(Base):
    __tablename__ = "branch_stock"

    id = Column(Integer, primary_key=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, default=0)
    min_quantity = Column(Integer, default=5)
    last_restocked = Column(DateTime)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    branch = relationship("Branch")
    product = relationship("Product", back_populates="stock_items")


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String(50), unique=True, index=True)
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"))
    cashier_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    subtotal = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), default=0)
    discount_percent = Column(Numeric(5, 2), default=0)
    discount_reason = Column(Text)
    tax_amount = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), nullable=False)
    
    payment_method = Column(String(50))
    payment_status = Column(String(50), default="pending")
    paid_amount = Column(Numeric(10, 2), default=0)
    change_amount = Column(Numeric(10, 2), default=0)
    
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)

    branch = relationship("Branch")
    patient = relationship("Patient")
    prescription = relationship("Prescription")
    cashier = relationship("User")
    items = relationship("SaleItem", back_populates="sale")
    payments = relationship("Payment", back_populates="sale")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), default=0)
    total = Column(Numeric(10, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(String(50), nullable=False)
    reference = Column(String(100))
    created_at = Column(DateTime, default=datetime.utcnow)

    sale = relationship("Sale", back_populates="payments")
