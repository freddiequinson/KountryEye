"""Patient checkout endpoint - aggregates all visit charges into unified receipt"""
from typing import Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import io

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.patient import Patient, Visit
from app.models.sales import Sale, SaleItem
from app.models.technician_referral import TechnicianScan, ScanPayment
from app.models.revenue import Revenue

router = APIRouter()


@router.get("/visits/{visit_id}/checkout-summary")
async def get_visit_checkout_summary(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get comprehensive checkout summary for a visit including all charges"""
    
    # Get visit with patient and consultation type
    result = await db.execute(
        select(Visit)
        .options(selectinload(Visit.patient), selectinload(Visit.consultation_type))
        .where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    patient = visit.patient
    
    # 1. Consultation fee
    consultation_fee = float(visit.consultation_fee or 0)
    consultation_paid = float(visit.amount_paid or 0)
    
    # 2. Get scans for this visit
    scan_result = await db.execute(
        select(TechnicianScan)
        .where(TechnicianScan.visit_id == visit_id)
    )
    scans = scan_result.scalars().all()
    
    scan_items = []
    total_scan_charges = 0
    total_scan_paid = 0
    
    for scan in scans:
        # Get payment for this scan
        payment_result = await db.execute(
            select(ScanPayment).where(ScanPayment.scan_id == scan.id)
        )
        payment = payment_result.scalar_one_or_none()
        
        scan_amount = float(payment.amount if payment else 0)
        scan_paid = scan_amount if (payment and payment.is_paid) else 0
        
        scan_items.append({
            "id": scan.id,
            "scan_number": scan.scan_number,
            "scan_type": scan.scan_type,
            "amount": scan_amount,
            "paid": scan_paid,
            "status": "paid" if (payment and payment.is_paid) else "pending"
        })
        total_scan_charges += scan_amount
        total_scan_paid += scan_paid
    
    # 3. Get POS sales linked to this visit
    from app.models.sales import SaleItem, Product
    
    sale_result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.product))
        .where(Sale.visit_id == visit_id)
    )
    sales = sale_result.scalars().all()
    
    # Collect all product items for display
    product_items = []
    total_sale_charges = 0
    total_sale_paid = 0
    
    for sale in sales:
        sale_total = float(sale.total_amount or 0)
        sale_paid = float(sale.paid_amount or 0)
        
        for item in sale.items:
            product_name = item.product.name if item.product else f"Product #{item.product_id}"
            product_items.append({
                "product_id": item.product_id,
                "product_name": product_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "total": float(item.total),
                "receipt_number": sale.receipt_number,
                "status": sale.payment_status or "completed"
            })
        
        total_sale_charges += sale_total
        total_sale_paid += sale_paid
    
    # Calculate totals for this visit
    grand_total = consultation_fee + total_scan_charges + total_sale_charges
    total_paid = consultation_paid + total_scan_paid + total_sale_paid
    balance_due = grand_total - total_paid
    
    # Get consultation type name
    consultation_type_name = None
    if visit.consultation_type:
        consultation_type_name = visit.consultation_type.name
    
    # Calculate patient's overall debt from ALL visits (excluding current visit)
    previous_visits_result = await db.execute(
        select(Visit).where(
            Visit.patient_id == patient.id,
            Visit.id != visit_id  # Exclude current visit
        )
    )
    previous_visits = previous_visits_result.scalars().all()
    
    previous_debt = 0
    for pv in previous_visits:
        pv_fee = float(pv.consultation_fee or 0)
        pv_paid = float(pv.amount_paid or 0)
        if pv_fee > pv_paid:
            previous_debt += (pv_fee - pv_paid)
    
    # Total debt = current visit balance + previous visits debt
    total_patient_debt = balance_due + previous_debt
    has_outstanding_debt = total_patient_debt > 0
    
    return {
        "visit_id": visit_id,
        "visit_number": visit.visit_number,
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else None,
        "visit_type": visit.visit_type.value if visit.visit_type else None,
        "status": visit.status,
        "checkout_time": visit.checkout_time.isoformat() if visit.checkout_time else None,
        "patient": {
            "id": patient.id,
            "patient_number": patient.patient_number,
            "name": f"{patient.first_name} {patient.last_name}",
            "phone": patient.phone
        },
        "charges": {
            "consultation": {
                "type": consultation_type_name,
                "fee": consultation_fee,
                "paid": consultation_paid,
                "balance": consultation_fee - consultation_paid,
                "payment_status": visit.payment_status
            },
            "scans": {
                "items": scan_items,
                "total": total_scan_charges,
                "paid": total_scan_paid,
                "balance": total_scan_charges - total_scan_paid
            },
            "products": {
                "items": product_items,
                "total": total_sale_charges,
                "paid": total_sale_paid,
                "balance": total_sale_charges - total_sale_paid
            }
        },
        "summary": {
            "grand_total": grand_total,
            "total_paid": total_paid,
            "balance_due": balance_due,
            "is_fully_paid": balance_due <= 0
        },
        "patient_debt": {
            "previous_visits_debt": previous_debt,
            "current_visit_balance": balance_due,
            "total_debt": total_patient_debt,
            "has_outstanding_debt": has_outstanding_debt,
            "debt_warning": f"This patient has an outstanding debt of GHS {total_patient_debt:.2f}" if has_outstanding_debt else None
        }
    }


@router.post("/visits/{visit_id}/checkout")
async def process_visit_checkout(
    visit_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Process checkout payment for remaining balance"""
    
    amount = Decimal(str(data.get("amount", 0)))
    payment_method = data.get("payment_method", "cash")
    
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be greater than 0")
    
    # Get visit
    result = await db.execute(
        select(Visit)
        .options(selectinload(Visit.patient))
        .where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Record revenue
    revenue = Revenue(
        category="checkout_payment",
        description=f"Checkout payment for visit {visit.visit_number}",
        amount=amount,
        payment_method=payment_method,
        reference_type="visit_checkout",
        reference_id=visit_id,
        patient_id=visit.patient_id,
        branch_id=visit.branch_id,
        recorded_by_id=current_user.id
    )
    db.add(revenue)
    
    await db.commit()
    
    return {
        "message": "Checkout payment recorded",
        "amount": float(amount),
        "payment_method": payment_method,
        "visit_id": visit_id
    }


@router.get("/visits/{visit_id}/checkout-receipt")
async def get_checkout_receipt(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Generate unified checkout receipt PDF"""
    from app.utils.pdf_generator import generate_checkout_receipt_pdf
    
    # Get checkout summary
    result = await db.execute(
        select(Visit)
        .options(selectinload(Visit.patient), selectinload(Visit.branch))
        .where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Get all charges (reuse summary logic)
    summary_data = await get_visit_checkout_summary(visit_id, db, current_user)
    
    # Generate PDF
    pdf_buffer = generate_checkout_receipt_pdf(
        visit=visit,
        patient=visit.patient,
        summary=summary_data,
        branch=visit.branch
    )
    
    return StreamingResponse(
        io.BytesIO(pdf_buffer),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=checkout-{visit.visit_number}.pdf"
        }
    )


@router.post("/visits/{visit_id}/complete-checkout")
async def complete_visit_checkout(
    visit_id: int,
    data: Optional[dict] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a visit as checked out / completed.
    
    If patient has outstanding debt, requires confirm_with_debt=true in request body.
    The debt will remain on their account for future payment.
    """
    
    result = await db.execute(
        select(Visit).options(selectinload(Visit.patient)).where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    patient = visit.patient
    
    # Calculate current visit balance
    consultation_fee = float(visit.consultation_fee or 0)
    amount_paid = float(visit.amount_paid or 0)
    current_balance = consultation_fee - amount_paid
    
    # Calculate total patient debt from all visits
    all_visits_result = await db.execute(
        select(Visit).where(Visit.patient_id == patient.id)
    )
    all_visits = all_visits_result.scalars().all()
    
    total_debt = 0
    for v in all_visits:
        v_fee = float(v.consultation_fee or 0)
        v_paid = float(v.amount_paid or 0)
        if v_fee > v_paid:
            total_debt += (v_fee - v_paid)
    
    # Check if patient has outstanding debt
    has_debt = total_debt > 0
    confirm_with_debt = (data or {}).get("confirm_with_debt", False)
    
    if has_debt and not confirm_with_debt:
        # Return debt warning - frontend should show confirmation dialog
        return {
            "requires_confirmation": True,
            "has_outstanding_debt": True,
            "total_debt": total_debt,
            "current_visit_balance": current_balance,
            "message": f"This patient has an outstanding debt of GHS {total_debt:.2f}. Are you sure you want to check them out? The debt will remain on their account.",
            "visit_id": visit_id
        }
    
    # Update visit status to checked_out
    visit.status = "checked_out"
    visit.checkout_time = datetime.utcnow()
    
    await db.commit()
    
    response = {
        "message": "Patient checked out successfully",
        "visit_id": visit_id,
        "status": "checked_out",
        "checkout_time": visit.checkout_time.isoformat()
    }
    
    if has_debt:
        response["debt_notice"] = f"Patient has outstanding debt of GHS {total_debt:.2f} remaining on their account."
        response["total_debt"] = total_debt
    
    return response


@router.get("/patients/{patient_id}/active-visits")
async def get_patient_active_visits(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get active visits for a patient (for POS linking)"""
    from datetime import date, datetime as dt, timedelta
    
    # Get today's visits that haven't been checked out yet (includes completed - doctor done but patient still in clinic)
    today_start = dt.combine(date.today(), dt.min.time())
    today_end = dt.combine(date.today(), dt.max.time())
    
    result = await db.execute(
        select(Visit)
        .where(
            Visit.patient_id == patient_id,
            Visit.visit_date >= today_start,
            Visit.visit_date <= today_end,
            Visit.status != "checked_out"
        )
        .order_by(Visit.visit_date.desc())
    )
    visits = result.scalars().all()
    
    return [
        {
            "id": v.id,
            "visit_number": v.visit_number,
            "visit_date": v.visit_date.isoformat() if v.visit_date else None,
            "visit_type": v.visit_type.value if v.visit_type else None,
            "status": v.status
        }
        for v in visits
    ]
