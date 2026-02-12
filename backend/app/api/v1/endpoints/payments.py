from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.patient import Patient
from app.models.payment import Invoice, InvoicePayment, PaymentStatus
from app.schemas.payment import (
    InvoiceCreate, InvoiceUpdate, InvoiceResponse,
    PaymentCreate, PaymentResponse
)

router = APIRouter()


def generate_invoice_number(branch_id: int, count: int) -> str:
    today = date.today()
    return f"INV-{branch_id:02d}-{today.strftime('%Y%m%d')}-{count:04d}"


def generate_receipt_number(branch_id: int, count: int) -> str:
    today = date.today()
    return f"RCP-{branch_id:02d}-{today.strftime('%Y%m%d')}-{count:04d}"


@router.get("/invoices", response_model=List[InvoiceResponse])
async def get_invoices(
    patient_id: Optional[int] = None,
    status: Optional[PaymentStatus] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Invoice)
    
    if patient_id:
        query = query.where(Invoice.patient_id == patient_id)
    if status:
        query = query.where(Invoice.status == status)
    
    query = query.order_by(Invoice.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice


@router.post("/invoices", response_model=InvoiceResponse)
async def create_invoice(
    invoice_in: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Get patient to get branch_id
    patient_result = await db.execute(select(Patient).where(Patient.id == invoice_in.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Calculate totals from items
    subtotal = sum(item.quantity * item.unit_price for item in invoice_in.items)
    total_amount = subtotal - invoice_in.discount + invoice_in.tax
    
    # Generate invoice number
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    count_result = await db.execute(
        select(func.count(Invoice.id)).where(
            Invoice.branch_id == patient.branch_id,
            Invoice.created_at >= today_start
        )
    )
    count = count_result.scalar() + 1
    
    invoice = Invoice(
        invoice_number=generate_invoice_number(patient.branch_id, count),
        visit_id=invoice_in.visit_id,
        patient_id=invoice_in.patient_id,
        branch_id=patient.branch_id,
        subtotal=subtotal,
        discount=invoice_in.discount,
        tax=invoice_in.tax,
        total_amount=total_amount,
        amount_paid=Decimal("0"),
        balance=total_amount,
        status=PaymentStatus.PENDING,
        notes=invoice_in.notes,
        created_by_id=current_user.id
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: int,
    invoice_in: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    for field, value in invoice_in.model_dump(exclude_unset=True).items():
        setattr(invoice, field, value)
    
    await db.commit()
    await db.refresh(invoice)
    return invoice


@router.get("/payments", response_model=List[PaymentResponse])
async def get_payments(
    invoice_id: Optional[int] = None,
    patient_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(InvoicePayment)
    
    if invoice_id:
        query = query.where(InvoicePayment.invoice_id == invoice_id)
    if patient_id:
        query = query.where(InvoicePayment.patient_id == patient_id)
    
    query = query.order_by(InvoicePayment.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/payments", response_model=PaymentResponse)
async def create_payment(
    payment_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.revenue import Revenue
    from sqlalchemy.orm import joinedload
    
    # Get invoice with patient
    invoice_result = await db.execute(
        select(Invoice)
        .options(joinedload(Invoice.patient))
        .where(Invoice.id == payment_in.invoice_id)
    )
    invoice = invoice_result.unique().scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if payment_in.amount <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be positive")
    
    if payment_in.amount > invoice.balance:
        raise HTTPException(status_code=400, detail="Payment amount exceeds invoice balance")
    
    # Generate receipt number
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    count_result = await db.execute(
        select(func.count(InvoicePayment.id)).where(
            InvoicePayment.branch_id == invoice.branch_id,
            InvoicePayment.created_at >= today_start
        )
    )
    count = count_result.scalar() + 1
    
    payment = InvoicePayment(
        receipt_number=generate_receipt_number(invoice.branch_id, count),
        invoice_id=invoice.id,
        patient_id=invoice.patient_id,
        branch_id=invoice.branch_id,
        amount=payment_in.amount,
        payment_method=payment_in.payment_method,
        reference=payment_in.reference,
        notes=payment_in.notes,
        received_by_id=current_user.id
    )
    db.add(payment)
    
    # Update invoice
    invoice.amount_paid = invoice.amount_paid + payment_in.amount
    invoice.balance = invoice.total_amount - invoice.amount_paid
    
    if invoice.balance <= 0:
        invoice.status = PaymentStatus.PAID
    else:
        invoice.status = PaymentStatus.PARTIAL
    
    # Record revenue for this payment
    patient_name = ""
    if invoice.patient:
        patient_name = f" - {invoice.patient.first_name} {invoice.patient.last_name}"
    
    revenue = Revenue(
        category="invoice_payment",
        description=f"Invoice payment{patient_name}",
        amount=float(payment_in.amount),
        payment_method=payment_in.payment_method,
        reference_type="invoice",
        reference_id=invoice.id,
        patient_id=invoice.patient_id,
        branch_id=invoice.branch_id,
        recorded_by_id=current_user.id,
        notes=f"Invoice #{invoice.invoice_number}"
    )
    db.add(revenue)
    
    await db.commit()
    await db.refresh(payment)
    return payment


@router.get("/patients/{patient_id}/balance")
async def get_patient_balance(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get total outstanding balance for a patient"""
    result = await db.execute(
        select(func.sum(Invoice.balance)).where(
            Invoice.patient_id == patient_id,
            Invoice.status.in_([PaymentStatus.PENDING, PaymentStatus.PARTIAL])
        )
    )
    total_balance = result.scalar() or Decimal("0")
    
    return {
        "patient_id": patient_id,
        "total_balance": float(total_balance)
    }
