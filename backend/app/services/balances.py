"""What a patient owes, in one place.

Used by checkout, the debtors list and SMS reminders so every screen agrees.
Charges come from four places: the visit's consultation fee, prescriptions,
scans and POS sales.
"""
from dataclasses import dataclass, field
from decimal import Decimal

from sqlalchemy import select

from app.services.billing import money, visit_total


@dataclass
class Charge:
    kind: str          # consultation | prescription | scan | sale
    id: int
    label: str
    total: Decimal
    paid: Decimal
    visit_id: int | None = None
    obj: object = field(default=None, repr=False)
    meta: dict = field(default_factory=dict)

    @property
    def balance(self) -> Decimal:
        return max(self.total - self.paid, Decimal("0.00"))


def scan_total(payment) -> Decimal:
    return money(payment.amount) + money(getattr(payment, "vat_amount", 0))


def _scan_paid(payment) -> Decimal:
    # Technician screens only flip is_paid; checkout can also part-pay through amount_paid
    if payment.is_paid:
        return scan_total(payment)
    return money(payment.amount_paid)


async def _charges(db, *, visit_id: int | None = None, patient_id: int | None = None) -> list[Charge]:
    from app.models.patient import Visit
    from app.models.clinical import Prescription, PrescriptionItem
    from app.models.sales import Sale
    from app.models.technician_referral import TechnicianScan, ScanPayment

    out: list[Charge] = []

    vq = select(Visit)
    vq = vq.where(Visit.id == visit_id) if visit_id else vq.where(Visit.patient_id == patient_id)
    for v in (await db.execute(vq)).scalars().all():
        out.append(Charge("consultation", v.id, f"Consultation {v.visit_number or v.id}", visit_total(v), money(v.amount_paid), v.id, v))

    pq = select(Prescription).where(Prescription.status.in_(["pending", "partial", "paid"]))
    pq = pq.where(Prescription.visit_id == visit_id) if visit_id else pq.where(Prescription.patient_id == patient_id)
    prescriptions = (await db.execute(pq)).scalars().all()
    if prescriptions:
        items = (await db.execute(
            select(PrescriptionItem).where(PrescriptionItem.prescription_id.in_([p.id for p in prescriptions]))
        )).scalars().all()
        totals: dict[int, Decimal] = {}
        for it in items:
            totals[it.prescription_id] = totals.get(it.prescription_id, Decimal("0")) + money(it.unit_price) * (it.quantity or 1)
        for p in prescriptions:
            net = money(totals.get(p.id, 0))
            total = net + money(getattr(p, "vat_amount", 0))
            if total <= 0:
                continue
            paid = money(p.amount_paid) if p.amount_paid is not None else (total if p.status == "paid" else Decimal("0"))
            out.append(Charge("prescription", p.id, f"Prescription RX-{p.id:06d}", total, paid, p.visit_id, p))

    sq = select(TechnicianScan, ScanPayment).join(ScanPayment, ScanPayment.scan_id == TechnicianScan.id)
    sq = sq.where(TechnicianScan.visit_id == visit_id) if visit_id else sq.where(TechnicianScan.patient_id == patient_id)
    for scan, payment in (await db.execute(sq)).all():
        out.append(Charge("scan", payment.id, f"{(scan.scan_type or 'Scan').upper()} scan {scan.scan_number or ''}".strip(),
                          scan_total(payment), _scan_paid(payment), scan.visit_id, payment,
                          {"scan_id": scan.id, "scan_number": scan.scan_number, "scan_type": scan.scan_type}))

    saq = select(Sale)
    saq = saq.where(Sale.visit_id == visit_id) if visit_id else saq.where(Sale.patient_id == patient_id)
    for s in (await db.execute(saq)).scalars().all():
        if (s.payment_status or "") in ("refunded", "cancelled", "void"):
            continue
        out.append(Charge("sale", s.id, f"Sale {s.receipt_number or s.id}", money(s.total_amount), money(s.paid_amount), s.visit_id, s))
    return out


async def visit_charges(db, visit_id: int) -> list[Charge]:
    return await _charges(db, visit_id=visit_id)


async def patient_charges(db, patient_id: int) -> list[Charge]:
    """All charges for a patient. Sales and scans are found by patient and by the patient's visits."""
    from app.models.patient import Visit
    found = {(c.kind, c.id): c for c in await _charges(db, patient_id=patient_id)}
    visit_ids = (await db.execute(select(Visit.id).where(Visit.patient_id == patient_id))).scalars().all()
    for vid in visit_ids:
        for c in await _charges(db, visit_id=vid):
            found.setdefault((c.kind, c.id), c)
    return list(found.values())


async def patient_balance(db, patient_id: int, exclude_visit_id: int | None = None) -> Decimal:
    total = Decimal("0.00")
    for c in await patient_charges(db, patient_id):
        if exclude_visit_id and c.visit_id == exclude_visit_id:
            continue
        total += c.balance
    return total


# Order money is applied in at checkout
PAY_ORDER = {"consultation": 0, "prescription": 1, "scan": 2, "sale": 3}
REVENUE_CATEGORY = {"consultation": "consultation", "prescription": "prescription", "scan": "service", "sale": "sales"}
REFERENCE_TYPE = {"consultation": "visit", "prescription": "prescription", "scan": "scan", "sale": "sale"}


def apply_payment_to_charge(charge: Charge, amount: Decimal, payment_method: str) -> None:
    """Move `amount` onto one charge's own record and update its status."""
    from datetime import datetime
    o = charge.obj
    new_paid = charge.paid + amount
    if charge.kind == "consultation":
        o.amount_paid = new_paid
        o.payment_status = "paid" if new_paid >= charge.total else "partial"
        if o.status == "pending_payment":
            o.status = "waiting"
    elif charge.kind == "prescription":
        o.amount_paid = new_paid
        o.status = "paid" if new_paid >= charge.total else "partial"
        o.payment_method = payment_method
        o.paid_at = datetime.utcnow()
    elif charge.kind == "scan":
        o.amount_paid = new_paid
        o.is_paid = new_paid >= charge.total
        o.payment_method = payment_method
        if o.is_paid:
            o.payment_date = datetime.utcnow()
    elif charge.kind == "sale":
        o.paid_amount = new_paid
        o.payment_status = "completed" if new_paid >= charge.total else "partial"
    charge.paid = new_paid


async def all_patient_balances(db) -> dict[int, Decimal]:
    """Outstanding balance per patient, reading each table once (for the debtors list and reminders).
    Same rules as patient_charges()."""
    from app.models.patient import Visit
    from app.models.clinical import Prescription, PrescriptionItem
    from app.models.sales import Sale
    from app.models.technician_referral import TechnicianScan, ScanPayment

    owed: dict[int, Decimal] = {}

    def add(pid, amount):
        if pid and amount > 0:
            owed[pid] = owed.get(pid, Decimal("0")) + amount

    visit_patient = {}
    for v in (await db.execute(select(Visit))).scalars().all():
        visit_patient[v.id] = v.patient_id
        add(v.patient_id, visit_total(v) - money(v.amount_paid))

    items: dict[int, Decimal] = {}
    for it in (await db.execute(select(PrescriptionItem))).scalars().all():
        items[it.prescription_id] = items.get(it.prescription_id, Decimal("0")) + money(it.unit_price) * (it.quantity or 1)
    for p in (await db.execute(select(Prescription).where(Prescription.status.in_(["pending", "partial", "paid"])))).scalars().all():
        total = money(items.get(p.id, 0)) + money(p.vat_amount)
        if total <= 0:
            continue
        paid = money(p.amount_paid) if p.amount_paid is not None else (total if p.status == "paid" else Decimal("0"))
        add(p.patient_id or visit_patient.get(p.visit_id), total - paid)

    for scan, pay in (await db.execute(select(TechnicianScan, ScanPayment).join(ScanPayment, ScanPayment.scan_id == TechnicianScan.id))).all():
        add(scan.patient_id or visit_patient.get(scan.visit_id), scan_total(pay) - _scan_paid(pay))

    for s in (await db.execute(select(Sale))).scalars().all():
        if (s.payment_status or "") in ("refunded", "cancelled", "void"):
            continue
        add(s.patient_id or visit_patient.get(s.visit_id), money(s.total_amount) - money(s.paid_amount))

    return {pid: amt.quantize(Decimal("0.01")) for pid, amt in owed.items() if amt > Decimal("0.004")}
