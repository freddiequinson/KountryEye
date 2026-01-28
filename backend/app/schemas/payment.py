from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel

from app.models.payment import PaymentStatus, PaymentMethod


class InvoiceItemCreate(BaseModel):
    description: str
    quantity: int = 1
    unit_price: Decimal
    

class InvoiceCreate(BaseModel):
    visit_id: Optional[int] = None
    patient_id: int
    items: List[InvoiceItemCreate] = []
    discount: Decimal = Decimal("0")
    tax: Decimal = Decimal("0")
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    discount: Optional[Decimal] = None
    tax: Optional[Decimal] = None
    notes: Optional[str] = None


class InvoiceResponse(BaseModel):
    id: int
    invoice_number: str
    visit_id: Optional[int] = None
    patient_id: int
    branch_id: int
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total_amount: Decimal
    amount_paid: Decimal
    balance: Decimal
    status: PaymentStatus
    notes: Optional[str] = None
    created_by_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    invoice_id: int
    amount: Decimal
    payment_method: PaymentMethod
    reference: Optional[str] = None
    notes: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    receipt_number: str
    invoice_id: int
    patient_id: int
    branch_id: int
    amount: Decimal
    payment_method: PaymentMethod
    reference: Optional[str] = None
    notes: Optional[str] = None
    received_by_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True
