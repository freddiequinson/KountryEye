"""Data for the A5 payment receipts (visit, prescription, sale).

Shared by the logged-in receipt routes and the public link sent by SMS."""
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload

from app.services.billing import money


def _fmt(dt) -> str:
    return (dt or datetime.now()).strftime("%Y-%m-%d %H:%M")


def _name(user) -> str | None:
    return f"{user.first_name} {user.last_name}".strip() if user else None


async def _branch_name(db, branch_id) -> str:
    from app.models.branch import Branch
    b = await db.get(Branch, branch_id) if branch_id else None
    return b.name if b else ""


async def _last_payment(db, reference_type: str, reference_id: int):
    from app.models.revenue import Revenue
    r = await db.execute(
        select(Revenue).options(joinedload(Revenue.recorded_by))
        .where(Revenue.reference_type == reference_type, Revenue.reference_id == reference_id)
        .order_by(Revenue.id.desc()).limit(1)
    )
    return r.unique().scalar_one_or_none()


async def visit_receipt_data(db, visit_id: int) -> dict | None:
    from app.models.patient import Visit
    visit = (await db.execute(
        select(Visit).options(joinedload(Visit.patient), joinedload(Visit.consultation_type)).where(Visit.id == visit_id)
    )).unique().scalar_one_or_none()
    if not visit:
        return None
    last = await _last_payment(db, "visit", visit.id)
    fee = money(visit.consultation_fee)
    vat = money(visit.vat_amount)
    name = f"Consultation - {visit.consultation_type.name}" if visit.consultation_type else "Consultation fee"
    return {
        "receipt_number": f"VIS-{visit.id:06d}",
        "date": _fmt(visit.visit_date),
        "branch": await _branch_name(db, visit.branch_id),
        "patient_name": f"{visit.patient.first_name} {visit.patient.last_name}" if visit.patient else "N/A",
        "patient_number": visit.patient.patient_number if visit.patient else "N/A",
        "patient_id": visit.patient_id,
        "items": [{"name": name, "quantity": 1, "unit_price": float(fee)}],
        "subtotal": float(fee),
        "discount": 0,
        "vat_rate": float(visit.vat_rate) if visit.vat_rate else None,
        "vat_amount": float(vat),
        "total": float(fee + vat),
        "payment_method": (last.payment_method if last else None) or visit.payment_type or "Cash",
        "amount_paid": float(money(visit.amount_paid)),
        "served_by": _name(last.recorded_by if last else None) or "Front Desk",
    }


async def prescription_receipt_data(db, prescription_id: int) -> dict | None:
    from app.models.clinical import Prescription
    p = (await db.execute(
        select(Prescription).options(joinedload(Prescription.patient), joinedload(Prescription.items)).where(Prescription.id == prescription_id)
    )).unique().scalar_one_or_none()
    if not p:
        return None
    last = await _last_payment(db, "prescription", p.id)
    net = sum((money(i.unit_price) * (i.quantity or 1) for i in p.items), Decimal("0"))
    vat = money(p.vat_amount)
    from app.models.patient import Visit
    visit = await db.get(Visit, p.visit_id) if p.visit_id else None
    return {
        "receipt_number": f"RX-{p.id:06d}",
        "date": _fmt(p.paid_at or p.created_at),
        "branch": await _branch_name(db, (last.branch_id if last else None) or (visit.branch_id if visit else None)),
        "patient_name": f"{p.patient.first_name} {p.patient.last_name}" if p.patient else "N/A",
        "patient_number": p.patient.patient_number if p.patient else "N/A",
        "patient_id": p.patient_id,
        "items": [{"name": i.name, "quantity": i.quantity or 1, "unit_price": float(money(i.unit_price))} for i in p.items],
        "subtotal": float(net),
        "discount": 0,
        "vat_rate": float(p.vat_rate) if p.vat_rate else None,
        "vat_amount": float(vat),
        "total": float(net + vat),
        "payment_method": p.payment_method or "Cash",
        "amount_paid": float(money(p.amount_paid)) if p.amount_paid is not None else float(net + vat),
        "served_by": _name(last.recorded_by if last else None),
    }


async def sale_receipt_data(db, sale_id: int) -> dict | None:
    from app.models.sales import Sale, SaleItem
    from app.models.patient import Patient
    sale = (await db.execute(
        select(Sale).options(selectinload(Sale.items).selectinload(SaleItem.product), selectinload(Sale.cashier)).where(Sale.id == sale_id)
    )).scalar_one_or_none()
    if not sale:
        return None
    patient = await db.get(Patient, sale.patient_id) if sale.patient_id else None
    subtotal = money(sale.subtotal)
    discount = money(sale.discount_amount) + money(subtotal * Decimal(str(sale.discount_percent or 0)) / 100)
    vat = money(sale.tax_amount)
    rate = sale.vat_rate
    if rate is None and vat > 0 and subtotal - discount > 0:
        rate = (vat / (subtotal - discount) * 100).quantize(Decimal("0.1"))  # older sales didn't store it
    return {
        "receipt_number": sale.receipt_number or f"SL-{sale.id:06d}",
        "date": _fmt(sale.created_at),
        "branch": await _branch_name(db, sale.branch_id),
        "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Walk-in Customer",
        "patient_number": patient.patient_number if patient else "N/A",
        "patient_id": sale.patient_id,
        "items": [{
            "name": i.product.name if i.product else f"Product #{i.product_id}",
            "quantity": i.quantity,
            "unit_price": float(money(i.unit_price)),
        } for i in sale.items],
        "subtotal": float(subtotal),
        "discount": float(discount),
        "vat_rate": float(rate) if rate else None,
        "vat_amount": float(vat),
        "total": float(money(sale.total_amount)),
        "payment_method": sale.payment_method or "Cash",
        "amount_paid": float(money(sale.paid_amount)),
        "served_by": _name(sale.cashier),
    }


BUILDERS = {"visit": visit_receipt_data, "prescription": prescription_receipt_data, "sale": sale_receipt_data}
