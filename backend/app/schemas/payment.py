from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, Field

from app.models.payment import PaymentStatus, PaymentMethod


# Money fields: finite, not negative, sensible upper bound
Money = lambda **kw: Field(ge=0, le=10_000_000, max_digits=12, decimal_places=2, allow_inf_nan=False, **kw)


class InvoiceItemCreate(BaseModel):
    description: str = Field(min_length=1, max_length=255)
    quantity: int = Field(default=1, gt=0, le=10_000)
    unit_price: Decimal = Money()


class InvoiceCreate(BaseModel):
    visit_id: Optional[int] = None
    patient_id: int
    items: List[InvoiceItemCreate] = Field(min_length=1, max_length=200)
    discount: Decimal = Money(default=Decimal("0"))
    tax: Decimal = Money(default=Decimal("0"))
    notes: Optional[str] = Field(default=None, max_length=1000)


class InvoiceUpdate(BaseModel):
    discount: Optional[Decimal] = Money(default=None)
    tax: Optional[Decimal] = Money(default=None)
    notes: Optional[str] = Field(default=None, max_length=1000)


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
    amount: Decimal = Field(gt=0, le=10_000_000, max_digits=12, decimal_places=2, allow_inf_nan=False)
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
