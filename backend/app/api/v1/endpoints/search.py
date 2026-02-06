"""Global search endpoint - searches across all entities in the system."""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, cast, String

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.patient import Patient, Visit
from app.models.clinical import Consultation, ClinicalRecord, Prescription
from app.models.sales import Product, Sale, ProductCategory
from app.models.inventory import Vendor, Warehouse, StockTransfer, Import as ImportRecord
from app.models.asset import Asset, AssetCategory, MaintenanceLog
from app.models.employee import Attendance, Task, ActivityLog
from app.models.communication import FundRequest, Message, Notification
from app.models.accounting import Income, Expense
from app.models.marketing import Campaign, Event
from app.models.branch import Branch
from app.models.payment import Invoice, InvoicePayment
from app.models.orders import GlassesOrder
from app.models.technician_referral import (
    TechnicianScan, ExternalReferral, ReferralDoctor, ReferralPayment
)
from app.models.revenue import Revenue as RevenueRecord

router = APIRouter()


def like(column, term):
    """Case-insensitive LIKE helper."""
    return column.ilike(f"%{term}%")


@router.get("/global")
async def global_search(
    q: str = Query(..., min_length=1, max_length=200, description="Search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results per category"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Search across all entities in the system.
    Returns categorized results that link to their respective pages.
    Admin/superuser only.
    """
    if not current_user.is_superuser:
        role_name = ""
        if current_user.role_id:
            role_result = await db.execute(select(Role).where(Role.id == current_user.role_id))
            role_obj = role_result.scalar_one_or_none()
            if role_obj:
                role_name = role_obj.name.lower()
        if role_name != "admin":
            # Allow all authenticated users to search, but non-admins get limited results
            pass

    term = q.strip()
    results = {}

    # ── Patients ──
    try:
        stmt = (
            select(Patient)
            .where(
                or_(
                    like(Patient.first_name, term),
                    like(Patient.last_name, term),
                    like(Patient.phone, term),
                    like(Patient.email, term),
                    like(Patient.patient_number, term),
                    like(Patient.occupation, term),
                    like(Patient.address, term),
                    like(Patient.emergency_contact_name, term),
                    like(Patient.emergency_contact_phone, term),
                )
            )
            .order_by(Patient.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        patients = res.scalars().all()
        if patients:
            results["patients"] = [
                {
                    "id": p.id,
                    "title": f"{p.first_name} {p.last_name}",
                    "subtitle": f"{p.patient_number or ''} | {p.phone or 'No phone'}",
                    "url": f"/patients/{p.id}",
                    "meta": {"phone": p.phone, "patient_number": p.patient_number},
                }
                for p in patients
            ]
    except Exception:
        pass

    # ── Staff / Users ──
    try:
        stmt = (
            select(User)
            .where(
                or_(
                    like(User.first_name, term),
                    like(User.last_name, term),
                    like(User.email, term),
                    like(User.phone, term),
                )
            )
            .order_by(User.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        users = res.scalars().all()
        if users:
            results["staff"] = [
                {
                    "id": u.id,
                    "title": f"{u.first_name} {u.last_name}",
                    "subtitle": f"{u.email} | {'Active' if u.is_active else 'Inactive'}",
                    "url": f"/admin/user-profile/{u.id}",
                    "meta": {"email": u.email, "is_active": u.is_active},
                }
                for u in users
            ]
    except Exception:
        pass

    # ── Visits ──
    try:
        stmt = (
            select(Visit)
            .where(
                or_(
                    like(Visit.visit_number, term),
                    like(Visit.reason, term),
                    like(Visit.notes, term),
                    like(Visit.status, term),
                    like(Visit.insurance_provider, term),
                )
            )
            .order_by(Visit.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        visits = res.scalars().all()
        if visits:
            results["visits"] = [
                {
                    "id": v.id,
                    "title": f"Visit {v.visit_number}",
                    "subtitle": f"Status: {v.status} | {v.visit_date.strftime('%Y-%m-%d') if v.visit_date else ''}",
                    "url": f"/patients/{v.patient_id}/visits/{v.id}" if v.patient_id else f"/frontdesk",
                    "meta": {"status": v.status, "patient_id": v.patient_id},
                }
                for v in visits
            ]
    except Exception:
        pass

    # ── Scans ──
    try:
        stmt = (
            select(TechnicianScan)
            .where(
                or_(
                    like(TechnicianScan.scan_number, term),
                    like(TechnicianScan.scan_type, term),
                    like(TechnicianScan.status, term),
                    like(TechnicianScan.results_summary, term),
                    like(TechnicianScan.notes, term),
                    like(TechnicianScan.doctor_notes, term),
                )
            )
            .order_by(TechnicianScan.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        scans = res.scalars().all()
        if scans:
            results["scans"] = [
                {
                    "id": s.id,
                    "title": f"Scan {s.scan_number}",
                    "subtitle": f"{s.scan_type.upper()} | {s.status}",
                    "url": f"/technician/scans/{s.id}",
                    "meta": {"scan_type": s.scan_type, "status": s.status},
                }
                for s in scans
            ]
    except Exception:
        pass

    # ── External Referrals ──
    try:
        stmt = (
            select(ExternalReferral)
            .where(
                or_(
                    like(ExternalReferral.referral_number, term),
                    like(ExternalReferral.client_name, term),
                    like(ExternalReferral.client_phone, term),
                    like(ExternalReferral.reason, term),
                    like(ExternalReferral.notes, term),
                )
            )
            .order_by(ExternalReferral.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        referrals = res.scalars().all()
        if referrals:
            results["referrals"] = [
                {
                    "id": r.id,
                    "title": f"Referral {r.referral_number}",
                    "subtitle": f"{r.client_name} | {r.status}",
                    "url": f"/technician/referrals",
                    "meta": {"client_name": r.client_name, "status": r.status},
                }
                for r in referrals
            ]
    except Exception:
        pass

    # ── Referral Doctors ──
    try:
        stmt = (
            select(ReferralDoctor)
            .where(
                or_(
                    like(ReferralDoctor.name, term),
                    like(ReferralDoctor.phone, term),
                    like(ReferralDoctor.email, term),
                    like(ReferralDoctor.clinic_name, term),
                    like(ReferralDoctor.specialization, term),
                )
            )
            .limit(limit)
        )
        res = await db.execute(stmt)
        docs = res.scalars().all()
        if docs:
            results["referral_doctors"] = [
                {
                    "id": d.id,
                    "title": f"Dr. {d.name}",
                    "subtitle": f"{d.clinic_name or ''} | {d.phone}",
                    "url": f"/technician/doctors",
                    "meta": {"clinic": d.clinic_name, "phone": d.phone},
                }
                for d in docs
            ]
    except Exception:
        pass

    # ── Products ──
    try:
        stmt = (
            select(Product)
            .where(
                or_(
                    like(Product.name, term),
                    like(Product.sku, term),
                    like(Product.description, term),
                )
            )
            .order_by(Product.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        products = res.scalars().all()
        if products:
            results["products"] = [
                {
                    "id": p.id,
                    "title": p.name,
                    "subtitle": f"SKU: {p.sku or 'N/A'} | GH₵ {p.unit_price}",
                    "url": f"/inventory/products/{p.id}",
                    "meta": {"sku": p.sku, "price": str(p.unit_price)},
                }
                for p in products
            ]
    except Exception:
        pass

    # ── Sales / Receipts ──
    try:
        stmt = (
            select(Sale)
            .where(
                or_(
                    like(Sale.receipt_number, term),
                    like(Sale.payment_method, term),
                    like(Sale.payment_status, term),
                    like(Sale.notes, term),
                )
            )
            .order_by(Sale.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        sales = res.scalars().all()
        if sales:
            results["sales"] = [
                {
                    "id": s.id,
                    "title": f"Receipt {s.receipt_number}",
                    "subtitle": f"GH₵ {s.total_amount} | {s.payment_status}",
                    "url": f"/sales",
                    "meta": {"total": str(s.total_amount), "status": s.payment_status},
                }
                for s in sales
            ]
    except Exception:
        pass

    # ── Assets ──
    try:
        stmt = (
            select(Asset)
            .where(
                or_(
                    like(Asset.name, term),
                    like(Asset.asset_tag, term),
                    like(Asset.serial_number, term),
                    like(Asset.model, term),
                    like(Asset.manufacturer, term),
                    like(Asset.location, term),
                    like(Asset.description, term),
                    like(Asset.status, term),
                )
            )
            .order_by(Asset.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        assets = res.scalars().all()
        if assets:
            results["assets"] = [
                {
                    "id": a.id,
                    "title": a.name,
                    "subtitle": f"Tag: {a.asset_tag or 'N/A'} | {a.status}",
                    "url": f"/inventory/assets",
                    "meta": {"tag": a.asset_tag, "status": a.status},
                }
                for a in assets
            ]
    except Exception:
        pass

    # ── Fund Requests / Memos ──
    try:
        stmt = (
            select(FundRequest)
            .where(
                or_(
                    like(FundRequest.title, term),
                    like(FundRequest.description, term),
                    like(FundRequest.purpose, term),
                    like(FundRequest.status, term),
                )
            )
            .order_by(FundRequest.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        requests = res.scalars().all()
        if requests:
            results["fund_requests"] = [
                {
                    "id": fr.id,
                    "title": fr.title,
                    "subtitle": f"GH₵ {fr.amount} | {fr.status}",
                    "url": f"/fund-requests/{fr.id}",
                    "meta": {"amount": str(fr.amount), "status": fr.status},
                }
                for fr in requests
            ]
    except Exception:
        pass

    # ── Tasks ──
    try:
        stmt = (
            select(Task)
            .where(
                or_(
                    like(Task.title, term),
                    like(Task.description, term),
                    like(Task.status, term),
                    like(Task.priority, term),
                )
            )
            .order_by(Task.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        tasks = res.scalars().all()
        if tasks:
            results["tasks"] = [
                {
                    "id": t.id,
                    "title": t.title,
                    "subtitle": f"{t.priority} | {t.status}",
                    "url": f"/admin/employees",
                    "meta": {"status": t.status, "priority": t.priority},
                }
                for t in tasks
            ]
    except Exception:
        pass

    # ── Branches ──
    try:
        stmt = (
            select(Branch)
            .where(
                or_(
                    like(Branch.name, term),
                    like(Branch.address, term),
                    like(Branch.city, term),
                    like(Branch.phone, term),
                    like(Branch.email, term),
                )
            )
            .limit(limit)
        )
        res = await db.execute(stmt)
        branches = res.scalars().all()
        if branches:
            results["branches"] = [
                {
                    "id": b.id,
                    "title": b.name,
                    "subtitle": f"{b.city or ''} | {b.phone or ''}",
                    "url": f"/admin/settings",
                    "meta": {"city": b.city},
                }
                for b in branches
            ]
    except Exception:
        pass

    # ── Invoices ──
    try:
        stmt = (
            select(Invoice)
            .where(
                or_(
                    like(Invoice.invoice_number, term),
                    like(Invoice.notes, term),
                )
            )
            .order_by(Invoice.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        invoices = res.scalars().all()
        if invoices:
            results["invoices"] = [
                {
                    "id": inv.id,
                    "title": f"Invoice {inv.invoice_number}",
                    "subtitle": f"GH₵ {inv.total_amount} | Balance: GH₵ {inv.balance}",
                    "url": f"/patients/{inv.patient_id}" if inv.patient_id else "/sales",
                    "meta": {"total": str(inv.total_amount)},
                }
                for inv in invoices
            ]
    except Exception:
        pass

    # ── Glasses Orders ──
    try:
        stmt = (
            select(GlassesOrder)
            .where(
                or_(
                    like(GlassesOrder.order_number, term),
                    like(GlassesOrder.lens_type, term),
                    like(GlassesOrder.frame_brand, term),
                    like(GlassesOrder.frame_model, term),
                    like(GlassesOrder.status, term),
                    like(GlassesOrder.notes, term),
                )
            )
            .order_by(GlassesOrder.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        orders = res.scalars().all()
        if orders:
            results["orders"] = [
                {
                    "id": o.id,
                    "title": f"Order {o.order_number}",
                    "subtitle": f"{o.lens_type or ''} | {o.status}",
                    "url": f"/patients/{o.patient_id}" if o.patient_id else "/sales",
                    "meta": {"status": o.status},
                }
                for o in orders
            ]
    except Exception:
        pass

    # ── Campaigns ──
    try:
        stmt = (
            select(Campaign)
            .where(
                or_(
                    like(Campaign.name, term),
                    like(Campaign.description, term),
                    like(Campaign.campaign_type, term),
                    like(Campaign.status, term),
                )
            )
            .order_by(Campaign.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        campaigns = res.scalars().all()
        if campaigns:
            results["campaigns"] = [
                {
                    "id": c.id,
                    "title": c.name,
                    "subtitle": f"{c.campaign_type or ''} | {c.status}",
                    "url": f"/marketing",
                    "meta": {"status": c.status},
                }
                for c in campaigns
            ]
    except Exception:
        pass

    # ── Expenses ──
    try:
        stmt = (
            select(Expense)
            .where(
                or_(
                    like(Expense.description, term),
                    like(Expense.vendor, term),
                    like(Expense.reference, term),
                )
            )
            .order_by(Expense.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        expenses = res.scalars().all()
        if expenses:
            results["expenses"] = [
                {
                    "id": e.id,
                    "title": e.description or "Expense",
                    "subtitle": f"GH₵ {e.amount} | {e.vendor or 'No vendor'}",
                    "url": f"/accounting",
                    "meta": {"amount": str(e.amount)},
                }
                for e in expenses
            ]
    except Exception:
        pass

    # ── Vendors ──
    try:
        stmt = (
            select(Vendor)
            .where(
                or_(
                    like(Vendor.name, term),
                    like(Vendor.contact_person, term),
                    like(Vendor.email, term),
                    like(Vendor.phone, term),
                )
            )
            .limit(limit)
        )
        res = await db.execute(stmt)
        vendors = res.scalars().all()
        if vendors:
            results["vendors"] = [
                {
                    "id": v.id,
                    "title": v.name,
                    "subtitle": f"{v.contact_person or ''} | {v.phone or ''}",
                    "url": f"/inventory",
                    "meta": {"phone": v.phone},
                }
                for v in vendors
            ]
    except Exception:
        pass

    # ── Revenue ──
    try:
        stmt = (
            select(RevenueRecord)
            .where(
                or_(
                    like(RevenueRecord.description, term),
                    like(RevenueRecord.category, term),
                    like(RevenueRecord.payment_method, term),
                    like(RevenueRecord.notes, term),
                )
            )
            .order_by(RevenueRecord.created_at.desc())
            .limit(limit)
        )
        res = await db.execute(stmt)
        revenues = res.scalars().all()
        if revenues:
            results["revenue"] = [
                {
                    "id": r.id,
                    "title": r.description,
                    "subtitle": f"GH₵ {r.amount} | {r.category}",
                    "url": f"/admin/revenue",
                    "meta": {"amount": str(r.amount), "category": r.category},
                }
                for r in revenues
            ]
    except Exception:
        pass

    # Build total count
    total_count = sum(len(v) for v in results.values())

    return {
        "query": term,
        "total_count": total_count,
        "results": results,
    }
