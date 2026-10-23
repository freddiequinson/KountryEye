"""Lab queue for glasses jobs, and lens deliveries to the warehouse or a branch."""
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, update, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_permission, has_permission, is_admin
from app.core.database import get_db
from app.models.user import User
from app.models.lab import LabJob, LensDelivery, LensDeliveryItem
from app.services import lab as lab_service
from app.services.sms.service import kick

router = APIRouter()

VIEW = require_permission("lab.view", "lab.manage")
MANAGE = require_permission("lab.manage")
# Handing glasses over is a front desk job: they can take the payment first
COLLECT = require_permission("payments.create")
DELIVER = require_permission("lab.deliveries")
DELIVERY_VIEW = require_permission("lab.deliveries", "inventory.receive", "inventory.manage")

STATUSES = ("received", "in_progress", "ready", "collected", "cancelled")


class StartIn(BaseModel):
    estimated_ready_date: date
    notes: Optional[str] = Field(default=None, max_length=1000)


class NotesIn(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=1000)


class DeliveryItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=100000)


class DeliveryIn(BaseModel):
    destination_type: str = Field(pattern="^(warehouse|branch)$")
    warehouse_id: Optional[int] = None
    branch_id: Optional[int] = None
    items: list[DeliveryItemIn] = Field(min_length=1, max_length=200)
    notes: Optional[str] = Field(default=None, max_length=1000)


class CollectIn(BaseModel):
    # Admin only: hand over with money still owing, with a reason for the audit log
    override_reason: Optional[str] = Field(default=None, max_length=255)


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=255)


class LensProductIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    unit_price: float = Field(ge=0)
    cost_price: Optional[float] = Field(default=None, ge=0)
    category_id: Optional[int] = None


# ---------- jobs ----------

async def _job_rows(db, jobs):
    from app.models.patient import Patient
    from app.models.clinical import Prescription
    from app.models.branch import Branch
    if not jobs:
        return []
    patients = {p.id: p for p in (await db.execute(select(Patient).where(Patient.id.in_({j.patient_id for j in jobs})))).scalars()}
    rxs = {r.id: r for r in (await db.execute(select(Prescription).where(Prescription.id.in_({j.prescription_id for j in jobs})))).scalars()}
    branches = {b.id: b.name for b in (await db.execute(select(Branch))).scalars()}
    users = {u.id: f"{u.first_name} {u.last_name}" for u in (await db.execute(select(User).where(User.id.in_({j.technician_id for j in jobs if j.technician_id})))).scalars()}
    today = date.today()
    owing = {j.id: await _glasses_balance(db, j) for j in jobs if j.status == "ready"}
    out = []
    for j in jobs:
        p, rx = patients.get(j.patient_id), rxs.get(j.prescription_id)
        out.append({
            "id": j.id, "job_number": j.job_number, "status": j.status,
            "patient_id": j.patient_id, "patient_name": f"{p.first_name} {p.last_name}" if p else "Unknown",
            "patient_number": p.patient_number if p else None, "patient_phone": p.phone if p else None,
            "pickup_branch": branches.get(j.pickup_branch_id), "pickup_branch_id": j.pickup_branch_id,
            "estimated_ready_date": j.estimated_ready_date, "technician": users.get(j.technician_id),
            "overdue": j.status in ("received", "in_progress") and j.estimated_ready_date is not None and j.estimated_ready_date < today,
            "created_at": j.created_at, "started_at": j.started_at, "ready_at": j.ready_at, "collected_at": j.collected_at,
            "notes": j.notes, "balance": float(owing.get(j.id, 0)), "visit_id": j.visit_id,
            "lens": ", ".join(x for x in [rx.lens_type, rx.lens_material, rx.lens_coating] if x) if rx else None,
            "frame": " ".join(x for x in [rx.frame_code, rx.frame_size] if x) if rx else None,
            "rx": {
                "od": {"sphere": rx.sphere_od, "cylinder": rx.cylinder_od, "axis": rx.axis_od, "va": rx.va_od},
                "os": {"sphere": rx.sphere_os, "cylinder": rx.cylinder_os, "axis": rx.axis_os, "va": rx.va_os},
                "add": rx.add_power, "pd": rx.pd, "segment_height": rx.segment_height, "remarks": rx.remarks,
                "doctor_delivery_date": rx.delivery_date,
            } if rx else None,
        })
    return out


@router.get("/jobs")
async def list_jobs(status: Optional[str] = None, search: Optional[str] = None, branch_id: Optional[int] = None,
                    db: AsyncSession = Depends(get_db), user: User = Depends(VIEW)):
    from app.models.patient import Patient
    q = select(LabJob)
    if status == "open":
        q = q.where(LabJob.status.in_(["received", "in_progress", "ready"]))
    elif status in STATUSES:
        q = q.where(LabJob.status == status)
    if branch_id:
        q = q.where(LabJob.pickup_branch_id == branch_id)
    if search:
        term = f"%{search.strip()[:50]}%"
        q = q.join(Patient, Patient.id == LabJob.patient_id).where(or_(
            LabJob.job_number.ilike(term), Patient.first_name.ilike(term), Patient.last_name.ilike(term),
            Patient.phone.ilike(term), Patient.patient_number.ilike(term)))
    jobs = (await db.execute(q.order_by(LabJob.id.desc()).limit(300))).scalars().all()
    rows = await _job_rows(db, jobs)
    counts = dict((await db.execute(select(LabJob.status, func.count()).group_by(LabJob.status))).all())
    overdue = (await db.execute(select(func.count()).select_from(LabJob).where(
        LabJob.status.in_(["received", "in_progress"]), LabJob.estimated_ready_date < date.today()))).scalar_one()
    return {"items": rows, "counts": {**{s: counts.get(s, 0) for s in STATUSES}, "overdue": overdue}}


async def _get_job(db, job_id) -> LabJob:
    job = await db.get(LabJob, job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job


@router.get("/jobs/{job_id}")
async def get_job(job_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(VIEW)):
    return (await _job_rows(db, [await _get_job(db, job_id)]))[0]


@router.post("/jobs/{job_id}/start")
async def start_job(job_id: int, data: StartIn, db: AsyncSession = Depends(get_db), user: User = Depends(MANAGE)):
    """Begin work (or move the date). The patient gets 'ready by <date>'."""
    job = await _get_job(db, job_id)
    if job.status not in ("received", "in_progress"):
        raise HTTPException(400, "This job is already finished")
    if data.estimated_ready_date < date.today():
        raise HTTPException(400, "The ready date can't be in the past")
    changed = job.estimated_ready_date != data.estimated_ready_date
    job.status = "in_progress"
    job.estimated_ready_date = data.estimated_ready_date
    job.started_at = job.started_at or datetime.utcnow()
    job.technician_id = job.technician_id or user.id
    job.overdue_notified_at = None
    if data.notes is not None:
        job.notes = data.notes
    if changed:
        await lab_service.sms_in_progress(db, job)
    await db.commit()
    kick()
    return (await _job_rows(db, [job]))[0]


@router.post("/jobs/{job_id}/ready")
async def mark_ready(job_id: int, data: NotesIn | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(MANAGE)):
    job = await _get_job(db, job_id)
    if job.status not in ("received", "in_progress"):
        raise HTTPException(400, "Only jobs being made can be marked ready")
    job.status = "ready"
    job.ready_at = datetime.utcnow()
    job.technician_id = job.technician_id or user.id
    if data and data.notes is not None:
        job.notes = data.notes
    await lab_service.sms_ready(db, job)
    await lab_service.notify_ready(db, job)
    await db.commit()
    kick()
    return (await _job_rows(db, [job]))[0]


async def _glasses_balance(db, job):
    """What is still owed on these glasses: the prescription's items plus any POS sale linked to it."""
    from decimal import Decimal
    from app.services.balances import patient_charges

    def for_these_glasses(c):
        if c.kind == "prescription":
            return c.id == job.prescription_id
        return c.kind == "sale" and getattr(c.obj, "prescription_id", None) == job.prescription_id

    if not job.patient_id:
        return Decimal("0")
    return sum((c.balance for c in await patient_charges(db, job.patient_id) if for_these_glasses(c)), Decimal("0"))


@router.post("/jobs/{job_id}/collect")
async def mark_collected(job_id: int, data: CollectIn | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(COLLECT)):
    """Front desk hands the glasses over. Anything owed on them must be paid first."""
    import json
    from app.models.audit import AuditLog
    job = await _get_job(db, job_id)
    if job.status != "ready":
        raise HTTPException(400, "Only ready glasses can be collected")
    owed = await _glasses_balance(db, job)
    reason = (data.override_reason or "").strip() if data else ""
    if owed > 0:
        if not reason:
            raise HTTPException(409, f"GHS {owed:,.2f} is still owed on these glasses. Take payment at checkout first.")
        if not is_admin(user):
            raise HTTPException(403, "Only an admin can hand over glasses that aren't paid for")
    # Claim the job so two clicks can't both hand it over
    now = datetime.utcnow()
    claimed = await db.execute(update(LabJob).where(LabJob.id == job.id, LabJob.status == "ready")
                               .values(status="collected", collected_at=now, collected_by_id=user.id))
    if claimed.rowcount != 1:
        await db.rollback()
        raise HTTPException(400, "Only ready glasses can be collected")
    if owed > 0:
        db.add(AuditLog(user_id=user.id, action="lab_collect_unpaid", entity_type="lab_jobs", entity_id=job.id,
                        new_values=json.dumps({"balance": str(owed), "reason": reason}),
                        ip_address=db.info.get("ip"), user_agent=db.info.get("user_agent")))
    from app.models.clinical import Prescription
    rx = await db.get(Prescription, job.prescription_id)
    if rx:
        rx.is_dispensed = True
        rx.dispensed_at = now
    await db.commit()
    await db.refresh(job)
    return (await _job_rows(db, [job]))[0]


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(job_id: int, data: NotesIn | None = None, db: AsyncSession = Depends(get_db), user: User = Depends(MANAGE)):
    job = await _get_job(db, job_id)
    if job.status in ("collected", "cancelled"):
        raise HTTPException(400, "This job is already closed")
    job.status = "cancelled"
    if data and data.notes:
        job.notes = data.notes
    await db.commit()
    return {"message": "Job cancelled"}


# ---------- lens products ----------

async def _lens_category_ids(db) -> list[int]:
    from app.models.sales import ProductCategory
    # Only categories named for lenses: other optical stock (frames) is not the lab's to add
    rows = (await db.execute(select(ProductCategory.id).where(func.lower(ProductCategory.name).like("%lens%")))).scalars().all()
    return list(rows)


@router.get("/lens-products")
async def lens_products(db: AsyncSession = Depends(get_db), user: User = Depends(DELIVERY_VIEW)):
    from app.models.sales import Product, ProductCategory
    cats = await _lens_category_ids(db)
    rows = (await db.execute(select(Product, ProductCategory.name).join(ProductCategory, ProductCategory.id == Product.category_id, isouter=True)
                             .where(Product.category_id.in_(cats), Product.is_active.is_(True)).order_by(Product.name))).all() if cats else []
    categories = (await db.execute(select(ProductCategory).where(ProductCategory.id.in_(cats)))).scalars().all() if cats else []
    return {"products": [{"id": p.id, "name": p.name, "sku": p.sku, "unit_price": float(p.unit_price or 0), "category": c} for p, c in rows],
            "categories": [{"id": c.id, "name": c.name} for c in categories]}


@router.post("/lens-products")
async def create_lens_product(data: LensProductIn, db: AsyncSession = Depends(get_db), user: User = Depends(DELIVER)):
    from app.models.sales import Product, ProductCategory
    cats = await _lens_category_ids(db)
    category_id = data.category_id
    if category_id is None or category_id not in cats:
        if not cats:
            cat = ProductCategory(name="Lenses", category_type="optical")
            db.add(cat)
            await db.flush()
            cats = [cat.id]
        category_id = category_id if category_id in cats else cats[0]
    if (await db.execute(select(Product.id).where(func.lower(Product.name) == data.name.strip().lower()))).first():
        raise HTTPException(400, "A product with this name already exists")
    count = (await db.execute(select(func.count(Product.id)))).scalar_one() + 1
    product = Product(name=data.name.strip(), unit_price=data.unit_price, cost_price=data.cost_price,
                      category_id=category_id, sku=f"LNS-{count:05d}", is_active=True)
    db.add(product)
    await db.commit()
    return {"id": product.id, "name": product.name, "sku": product.sku}


# ---------- deliveries ----------

async def _delivery_rows(db, rows):
    from app.models.sales import Product
    from app.models.branch import Branch
    from app.models.inventory import Warehouse
    if not rows:
        return []
    items = (await db.execute(select(LensDeliveryItem).where(LensDeliveryItem.delivery_id.in_([d.id for d in rows])))).scalars().all()
    products = {p.id: p.name for p in (await db.execute(select(Product).where(Product.id.in_({i.product_id for i in items})))).scalars()}
    branches = {b.id: b.name for b in (await db.execute(select(Branch))).scalars()}
    warehouses = {w.id: w.name for w in (await db.execute(select(Warehouse))).scalars()}
    users = {u.id: f"{u.first_name} {u.last_name}" for u in (await db.execute(select(User).where(User.id.in_(
        {d.technician_id for d in rows} | {d.confirmed_by_id for d in rows if d.confirmed_by_id})))).scalars()}
    by_delivery = {}
    for i in items:
        by_delivery.setdefault(i.delivery_id, []).append({"product_id": i.product_id, "product": products.get(i.product_id), "quantity": i.quantity})
    return [{
        "id": d.id, "delivery_number": d.delivery_number, "status": d.status,
        "destination_type": d.destination_type,
        "destination": warehouses.get(d.warehouse_id) if d.destination_type == "warehouse" else branches.get(d.branch_id),
        "warehouse_id": d.warehouse_id, "branch_id": d.branch_id, "notes": d.notes, "reject_reason": d.reject_reason,
        "technician": users.get(d.technician_id), "confirmed_by": users.get(d.confirmed_by_id),
        "created_at": d.created_at, "confirmed_at": d.confirmed_at, "items": by_delivery.get(d.id, []),
    } for d in rows]


def _can_confirm(user: User, d: LensDelivery) -> bool:
    if is_admin(user) or has_permission(user, "inventory.manage"):
        return True
    return d.destination_type == "branch" and has_permission(user, "inventory.receive") and (
        user.branch_id == d.branch_id or any(b.id == d.branch_id for b in (user.additional_branches or [])))


@router.get("/deliveries")
async def list_deliveries(status: Optional[str] = None, db: AsyncSession = Depends(get_db), user: User = Depends(DELIVERY_VIEW)):
    q = select(LensDelivery)
    if status:
        q = q.where(LensDelivery.status == status)
    # Branch staff only see deliveries to their branch; the lab and stock managers see all
    if not (is_admin(user) or has_permission(user, "inventory.manage", "lab.deliveries")):
        q = q.where(LensDelivery.destination_type == "branch", LensDelivery.branch_id == user.branch_id)
    rows = (await db.execute(q.order_by(LensDelivery.id.desc()).limit(200))).scalars().all()
    out = await _delivery_rows(db, rows)
    for row, d in zip(out, rows):
        row["can_confirm"] = d.status == "pending" and _can_confirm(user, d)
    return out


@router.post("/deliveries")
async def create_delivery(data: DeliveryIn, db: AsyncSession = Depends(get_db), user: User = Depends(DELIVER)):
    from app.models.sales import Product
    from app.models.branch import Branch
    from app.models.inventory import Warehouse
    if data.destination_type == "warehouse":
        if not data.warehouse_id or not await db.get(Warehouse, data.warehouse_id):
            raise HTTPException(400, "Choose a warehouse")
    elif not data.branch_id or not await db.get(Branch, data.branch_id):
        raise HTTPException(400, "Choose a branch")
    ids = {i.product_id for i in data.items}
    cats = await _lens_category_ids(db)
    found = set((await db.execute(select(Product.id).where(Product.id.in_(ids), Product.category_id.in_(cats)))).scalars().all()) if cats else set()
    if found != ids:
        raise HTTPException(400, "Deliveries can only contain lens products")
    count = (await db.execute(select(func.count(LensDelivery.id)))).scalar_one() + 1
    d = LensDelivery(delivery_number=f"LD-{date.today():%y%m%d}-{count:04d}", technician_id=user.id,
                     destination_type=data.destination_type,
                     warehouse_id=data.warehouse_id if data.destination_type == "warehouse" else None,
                     branch_id=data.branch_id if data.destination_type == "branch" else None, notes=data.notes)
    db.add(d)
    await db.flush()
    merged = {}
    for i in data.items:
        merged[i.product_id] = merged.get(i.product_id, 0) + i.quantity
    for pid, qty in merged.items():
        db.add(LensDeliveryItem(delivery_id=d.id, product_id=pid, quantity=qty))
    # Tell whoever must confirm it
    q = lab_service._staff_with({"inventory.receive"} if d.destination_type == "branch" else {"inventory.manage"})
    if d.destination_type == "branch":
        q = q.where(User.branch_id == d.branch_id)
    receivers = (await db.execute(q)).scalars().all()
    from app.models.communication import Notification
    for u in receivers:
        db.add(Notification(user_id=u.id, title="Lens delivery to confirm", message=f"Delivery {d.delivery_number} from the lab needs checking in.",
                            notification_type="system", reference_type="lens_delivery", reference_id=d.id, action_url="/lab?tab=deliveries"))
    await db.commit()
    return (await _delivery_rows(db, [d]))[0]


async def _claim_delivery(db, delivery_id: int, user: User, status: str, action: str, reason: str | None = None) -> LensDelivery:
    """Move a pending delivery to confirmed/rejected in one UPDATE, so only one request wins."""
    d = await db.get(LensDelivery, delivery_id)
    if not d:
        raise HTTPException(404, "Delivery not found")
    if d.status != "pending":
        raise HTTPException(400, "This delivery was already handled")
    if not _can_confirm(user, d):
        raise HTTPException(403, f"Only staff at the receiving branch (or stock managers) can {action} this")
    claimed = await db.execute(update(LensDelivery).where(LensDelivery.id == d.id, LensDelivery.status == "pending")
                               .values(status=status, confirmed_by_id=user.id, confirmed_at=datetime.utcnow(), reject_reason=reason))
    if claimed.rowcount != 1:
        await db.rollback()
        raise HTTPException(400, "This delivery was already handled")
    return d


@router.post("/deliveries/{delivery_id}/confirm")
async def confirm_delivery(delivery_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(DELIVERY_VIEW)):
    """Count received: stock goes up at the destination only now."""
    from app.models.sales import BranchStock
    from app.models.inventory import WarehouseStock
    d = await _claim_delivery(db, delivery_id, user, "confirmed", "confirm")
    items = (await db.execute(select(LensDeliveryItem).where(LensDeliveryItem.delivery_id == d.id))).scalars().all()
    for i in items:
        if d.destination_type == "branch":
            model, where = BranchStock, (BranchStock.branch_id == d.branch_id, BranchStock.product_id == i.product_id)
            new_row = dict(branch_id=d.branch_id)
        else:
            model, where = WarehouseStock, (WarehouseStock.warehouse_id == d.warehouse_id, WarehouseStock.product_id == i.product_id)
            new_row = dict(warehouse_id=d.warehouse_id)
        # Add in SQL rather than read-then-write, so concurrent stock changes aren't lost
        bumped = await db.execute(update(model).where(*where).values(quantity=func.coalesce(model.quantity, 0) + i.quantity))
        if bumped.rowcount == 0:
            db.add(model(product_id=i.product_id, quantity=i.quantity, min_quantity=5, **new_row))
    await db.commit()
    return {"message": "Delivery received and stock updated"}


@router.post("/deliveries/{delivery_id}/reject")
async def reject_delivery(delivery_id: int, data: RejectIn, db: AsyncSession = Depends(get_db), user: User = Depends(DELIVERY_VIEW)):
    await _claim_delivery(db, delivery_id, user, "rejected", "reject", data.reason)
    await db.commit()
    return {"message": "Delivery rejected"}
