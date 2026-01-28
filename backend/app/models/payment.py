from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    PARTIAL = "partial"
    PAID = "paid"
    REFUNDED = "refunded"


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    MOBILE_MONEY = "mobile_money"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    INSURANCE = "insurance"


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(30), unique=True, index=True)
    
    visit_id = Column(Integer, ForeignKey("visits.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    subtotal = Column(Numeric(10, 2), default=0)
    discount = Column(Numeric(10, 2), default=0)
    tax = Column(Numeric(10, 2), default=0)
    total_amount = Column(Numeric(10, 2), nullable=False)
    amount_paid = Column(Numeric(10, 2), default=0)
    balance = Column(Numeric(10, 2), default=0)
    
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    notes = Column(Text)
    
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    visit = relationship("Visit", backref="invoices")
    patient = relationship("Patient", backref="invoices")
    payments = relationship("InvoicePayment", back_populates="invoice")


class InvoicePayment(Base):
    __tablename__ = "invoice_payments"

    id = Column(Integer, primary_key=True, index=True)
    receipt_number = Column(String(30), unique=True, index=True)
    
    invoice_id = Column(Integer, ForeignKey("invoices.id"))
    patient_id = Column(Integer, ForeignKey("patients.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    amount = Column(Numeric(10, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    
    reference = Column(String(100))  # For mobile money/card transaction reference
    notes = Column(Text)
    
    received_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    invoice = relationship("Invoice", back_populates="payments")
    patient = relationship("Patient", backref="invoice_payments")
