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
    from app.services.balances import visit_charges, patient_balance

    result = await db.execute(
        select(Visit)
        .options(selectinload(Visit.patient), selectinload(Visit.consultation_type))
        .where(Visit.id == visit_id)
    )
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    patient = visit.patient

    charges = await visit_charges(db, visit_id)
    by_kind = lambda k: [c for c in charges if c.kind == k]
    consult = next(iter(by_kind("consultation")), None)

    scan_items = [{
        "id": c.meta["scan_id"], "scan_number": c.meta["scan_number"], "scan_type": c.meta["scan_type"],
        "amount": float(c.total), "paid": float(c.paid), "status": "paid" if c.balance <= 0 else "pending",
    } for c in by_kind("scan")]

    # Product lines, with each sale's own discount and VAT shown so the rows add up
    sales = (await db.execute(
        select(Sale).options(selectinload(Sale.items).selectinload(SaleItem.product)).where(Sale.visit_id == visit_id)
    )).scalars().all()
    product_items = []
    sale_tax = Decimal("0")
    sale_discount = Decimal("0")
    for sale in sales:
        for item in sale.items:
            product_items.append({
                "product_id": item.product_id,
                "product_name": item.product.name if item.product else f"Product #{item.product_id}",
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "total": float(item.total),
                "receipt_number": sale.receipt_number,
                "status": sale.payment_status or "completed",
            })
        sale_tax += Decimal(str(sale.tax_amount or 0))
        sale_discount += Decimal(str(sale.discount_amount or 0))
        if sale.discount_percent:
            sale_discount += (Decimal(str(sale.subtotal or 0)) * Decimal(str(sale.discount_percent)) / 100).quantize(Decimal("0.01"))

    prescription_items = [{
        "id": c.id, "label": c.label, "amount": float(c.total), "paid": float(c.paid), "balance": float(c.balance),
    } for c in by_kind("prescription")]

    def sums(kind):
        cs = by_kind(kind)
        t = sum((c.total for c in cs), Decimal("0")); p = sum((c.paid for c in cs), Decimal("0"))
        return float(t), float(p), float(max(t - p, 0))

    s_t, s_p, s_b = sums("scan")
    p_t, p_p, p_b = sums("sale")
    rx_t, rx_p, rx_b = sums("prescription")
    grand_total = sum((c.total for c in charges), Decimal("0"))
    total_paid = sum((c.paid for c in charges), Decimal("0"))
    balance_due = sum((c.balance for c in charges), Decimal("0"))

    # Invoice lines at their pre-VAT price, so lines - discount + VAT = grand total
    from app.services.billing import money
    lines = []
    vat_total = Decimal("0")
    if consult and money(visit.consultation_fee) > 0:
        name = f"Consultation - {visit.consultation_type.name}" if visit.consultation_type else "Consultation fee"
        lines.append({"description": name, "quantity": 1, "amount": float(money(visit.consultation_fee))})
        vat_total += money(visit.vat_amount)
    for c in by_kind("prescription"):
        lines.append({"description": c.label.replace("Prescription", "Prescription items"), "quantity": 1,
                      "amount": float(c.total - money(c.obj.vat_amount))})
        vat_total += money(c.obj.vat_amount)
    for c in by_kind("scan"):
        lines.append({"description": f"{(c.meta['scan_type'] or 'scan').upper()} scan", "quantity": 1, "amount": float(money(c.obj.amount))})
        vat_total += money(c.obj.vat_amount)
    for item in product_items:
        lines.append({"description": item["product_name"], "quantity": item["quantity"], "amount": item["total"]})
    vat_total += sale_tax
    rates = {float(r) for r in [visit.vat_rate] + [getattr(c.obj, "vat_rate", None) for c in by_kind("prescription")] + [s.vat_rate for s in sales] if r}
    lines_subtotal = sum((Decimal(str(l["amount"])) for l in lines), Decimal("0"))

    previous_debt = await patient_balance(db, patient.id, exclude_visit_id=visit_id)
    total_patient_debt = balance_due + previous_debt
    has_outstanding_debt = total_patient_debt > 0
    consult_vat = float(getattr(visit, "vat_amount", 0) or 0)

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
                "type": visit.consultation_type.name if visit.consultation_type else None,
                "fee": float(consult.total) if consult else 0,
                "net": float(visit.consultation_fee or 0),
                "vat": consult_vat,
                "paid": float(consult.paid) if consult else 0,
                "balance": float(consult.balance) if consult else 0,
                "payment_status": visit.payment_status
            },
            "scans": {"items": scan_items, "total": s_t, "paid": s_p, "balance": s_b},
            "prescriptions": {"items": prescription_items, "total": rx_t, "paid": rx_p, "balance": rx_b},
            "products": {
                "items": product_items,
                "total": p_t,
                "discount": float(sale_discount),
                "tax": float(sale_tax),
                "paid": p_p,
                "balance": p_b
            }
        },
        "lines": lines,
        "summary": {
            "subtotal": float(lines_subtotal),
            "discount": float(sale_discount),
            "vat_rate": rates.pop() if len(rates) == 1 else None,
            "grand_total": float(grand_total),
            "vat_total": float(vat_total),
            "total_paid": float(total_paid),
            "balance_due": float(balance_due),
            "is_fully_paid": balance_due <= 0
        },
        "patient_debt": {
            "previous_visits_debt": float(previous_debt),
            "current_visit_balance": float(balance_due),
            "total_debt": float(total_patient_debt),
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
    """Take a payment at checkout and spread it over what is still owed on the visit:
    consultation first, then prescriptions, scans and products."""
    from app.services.balances import visit_charges, apply_payment_to_charge, PAY_ORDER, REVENUE_CATEGORY, REFERENCE_TYPE
    from app.services.billing import parse_amount

    visit = (await db.execute(
        select(Visit).options(selectinload(Visit.patient)).where(Visit.id == visit_id)
    )).scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    charges = sorted((c for c in await visit_charges(db, visit_id) if c.balance > 0), key=lambda c: PAY_ORDER[c.kind])
    owed = sum((c.balance for c in charges), Decimal("0"))
    if owed <= 0:
        raise HTTPException(status_code=400, detail="Nothing is owed on this visit")
    offered = parse_amount(data.get("amount"), owed)
    payment_method = str(data.get("payment_method") or "cash")[:50]
    patient_name = f" - {visit.patient.first_name} {visit.patient.last_name}" if visit.patient else ""

    remaining = offered
    applied_lines = []
    for c in charges:
        if remaining <= 0:
            break
        take = min(remaining, c.balance)
        apply_payment_to_charge(c, take, payment_method)
        db.add(Revenue(
            category=REVENUE_CATEGORY[c.kind],
            description=f"Checkout: {c.label}{patient_name}",
            amount=take,
            payment_method=payment_method,
            reference_type=REFERENCE_TYPE[c.kind],
            reference_id=c.meta["scan_id"] if c.kind == "scan" else c.id,
            patient_id=visit.patient_id,
            branch_id=visit.branch_id,
            recorded_by_id=current_user.id
        ))
        applied_lines.append({"kind": c.kind, "label": c.label, "amount": float(take)})
        remaining -= take

    await db.commit()
    applied = offered - remaining
    return {
        "message": "Checkout payment recorded",
        "amount": float(applied),
        "change": float(remaining),
        "balance": float(owed - applied),
        "applied_to": applied_lines,
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
        branch=visit.branch,
        issued_by=f"{current_user.first_name} {current_user.last_name}".strip()
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

    from app.services.balances import patient_balance, visit_charges
    current_balance = float(sum((c.balance for c in await visit_charges(db, visit_id)), Decimal("0")))
    total_debt = float(await patient_balance(db, patient.id))

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
