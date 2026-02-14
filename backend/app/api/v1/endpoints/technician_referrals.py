"""
Technician Referral System API Endpoints

Handles:
- Referral doctors management
- External referrals intake
- Technician scans (OCT, VFT, Fundus, Pachymeter)
- Referral payments tracking
"""

from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from pydantic import BaseModel
import os
import shutil

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.patient import Patient, Visit
from app.models.clinical import Consultation
from app.models.technician_referral import (
    ReferralDoctor, ExternalReferral, TechnicianScan,
    ReferralPaymentSetting, ReferralPayment, ScanPricing, ScanPayment
)
from app.models.revenue import Revenue

router = APIRouter()

# ============ PYDANTIC SCHEMAS ============

class ReferralDoctorCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    specialization: Optional[str] = None
    notes: Optional[str] = None


class ReferralDoctorUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    clinic_name: Optional[str] = None
    clinic_address: Optional[str] = None
    specialization: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ExternalReferralCreate(BaseModel):
    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    client_dob: Optional[date] = None
    client_sex: Optional[str] = None
    referral_doctor_id: int
    reason: Optional[str] = None
    notes: Optional[str] = None
    service_fee: Optional[float] = 0


class ExternalReferralUpdate(BaseModel):
    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[str] = None
    client_address: Optional[str] = None
    client_dob: Optional[date] = None
    client_sex: Optional[str] = None
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    service_fee: Optional[float] = None
    patient_id: Optional[int] = None


class TechnicianScanCreate(BaseModel):
    scan_type: str  # oct, vft, fundus, pachymeter
    patient_id: Optional[int] = None
    external_referral_id: Optional[int] = None
    visit_id: Optional[int] = None
    consultation_id: Optional[int] = None
    od_results: Optional[dict] = None
    os_results: Optional[dict] = None
    results_summary: Optional[str] = None
    notes: Optional[str] = None


class TechnicianScanUpdate(BaseModel):
    od_results: Optional[dict] = None
    os_results: Optional[dict] = None
    results_summary: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None
    doctor_notes: Optional[str] = None


class PaymentSettingCreate(BaseModel):
    referral_doctor_id: Optional[int] = None  # None = default for all
    payment_type: str  # percentage or fixed
    rate: float
    effective_from: Optional[date] = None


class PaymentCreate(BaseModel):
    referral_doctor_id: int
    external_referral_id: Optional[int] = None
    service_amount: float
    amount: float
    payment_type: Optional[str] = None
    payment_rate: Optional[float] = None
    notes: Optional[str] = None


class PaymentUpdate(BaseModel):
    is_paid: Optional[bool] = None
    payment_method: Optional[str] = None
    payment_date: Optional[datetime] = None
    reference_number: Optional[str] = None
    notes: Optional[str] = None


# ============ HELPER FUNCTIONS ============

async def generate_referral_number(db: AsyncSession) -> str:
    """Generate unique referral number: REF-YYYYMMDD-XXX"""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"REF-{today}-"
    
    result = await db.execute(
        select(func.count(ExternalReferral.id))
        .where(ExternalReferral.referral_number.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(3)}"


async def generate_scan_number(db: AsyncSession) -> str:
    """Generate unique scan number: SCN-YYYYMMDD-XXX"""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"SCN-{today}-"
    
    result = await db.execute(
        select(func.count(TechnicianScan.id))
        .where(TechnicianScan.scan_number.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(3)}"


async def generate_payment_number(db: AsyncSession) -> str:
    """Generate unique payment number: PAY-YYYYMMDD-XXX"""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"PAY-{today}-"
    
    result = await db.execute(
        select(func.count(ReferralPayment.id))
        .where(ReferralPayment.payment_number.like(f"{prefix}%"))
    )
    count = result.scalar() or 0
    return f"{prefix}{str(count + 1).zfill(3)}"


# ============ REFERRAL DOCTORS ENDPOINTS ============

@router.get("/doctors")
async def list_referral_doctors(
    search: Optional[str] = None,
    is_active: Optional[bool] = True,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all referral doctors with optional search"""
    query = select(ReferralDoctor)
    
    if is_active is not None:
        query = query.where(ReferralDoctor.is_active == is_active)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                ReferralDoctor.name.ilike(search_term),
                ReferralDoctor.phone.ilike(search_term),
                ReferralDoctor.clinic_name.ilike(search_term)
            )
        )
    
    query = query.order_by(desc(ReferralDoctor.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    doctors = result.scalars().all()
    
    return [
        {
            "id": d.id,
            "name": d.name,
            "phone": d.phone,
            "email": d.email,
            "clinic_name": d.clinic_name,
            "clinic_address": d.clinic_address,
            "specialization": d.specialization,
            "notes": d.notes,
            "is_active": d.is_active,
            "created_at": d.created_at.isoformat() if d.created_at else None
        }
        for d in doctors
    ]


@router.get("/doctors/lookup/{phone}")
async def lookup_doctor_by_phone(
    phone: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Lookup referral doctor by phone number - for quick intake"""
    # Clean phone number
    clean_phone = phone.replace(" ", "").replace("-", "")
    
    result = await db.execute(
        select(ReferralDoctor).where(
            or_(
                ReferralDoctor.phone == phone,
                ReferralDoctor.phone == clean_phone,
                ReferralDoctor.phone.like(f"%{clean_phone[-9:]}%")  # Match last 9 digits
            )
        )
    )
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        return {"found": False, "doctor": None}
    
    return {
        "found": True,
        "doctor": {
            "id": doctor.id,
            "name": doctor.name,
            "phone": doctor.phone,
            "email": doctor.email,
            "clinic_name": doctor.clinic_name,
            "clinic_address": doctor.clinic_address,
            "specialization": doctor.specialization
        }
    }


@router.post("/doctors")
async def create_referral_doctor(
    data: ReferralDoctorCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new referral doctor"""
    # Check if phone already exists
    existing = await db.execute(
        select(ReferralDoctor).where(ReferralDoctor.phone == data.phone)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Doctor with this phone number already exists")
    
    doctor = ReferralDoctor(
        name=data.name,
        phone=data.phone,
        email=data.email,
        clinic_name=data.clinic_name,
        clinic_address=data.clinic_address,
        specialization=data.specialization,
        notes=data.notes
    )
    db.add(doctor)
    await db.commit()
    await db.refresh(doctor)
    
    return {
        "id": doctor.id,
        "name": doctor.name,
        "phone": doctor.phone,
        "message": "Referral doctor created successfully"
    }


@router.put("/doctors/{doctor_id}")
async def update_referral_doctor(
    doctor_id: int,
    data: ReferralDoctorUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a referral doctor"""
    result = await db.execute(
        select(ReferralDoctor).where(ReferralDoctor.id == doctor_id)
    )
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Referral doctor not found")
    
    # Update fields
    for field, value in data.dict(exclude_unset=True).items():
        setattr(doctor, field, value)
    
    doctor.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Referral doctor updated successfully"}


@router.get("/doctors/{doctor_id}")
async def get_referral_doctor(
    doctor_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single referral doctor with stats"""
    result = await db.execute(
        select(ReferralDoctor).where(ReferralDoctor.id == doctor_id)
    )
    doctor = result.scalar_one_or_none()
    
    if not doctor:
        raise HTTPException(status_code=404, detail="Referral doctor not found")
    
    # Get referral count
    referral_count = await db.execute(
        select(func.count(ExternalReferral.id))
        .where(ExternalReferral.referral_doctor_id == doctor_id)
    )
    
    # Get total payments
    payments_result = await db.execute(
        select(
            func.sum(ReferralPayment.amount),
            func.sum(ReferralPayment.amount).filter(ReferralPayment.is_paid == True)
        )
        .where(ReferralPayment.referral_doctor_id == doctor_id)
    )
    payments = payments_result.first()
    
    return {
        "id": doctor.id,
        "name": doctor.name,
        "phone": doctor.phone,
        "email": doctor.email,
        "clinic_name": doctor.clinic_name,
        "clinic_address": doctor.clinic_address,
        "specialization": doctor.specialization,
        "notes": doctor.notes,
        "is_active": doctor.is_active,
        "created_at": doctor.created_at.isoformat() if doctor.created_at else None,
        "stats": {
            "total_referrals": referral_count.scalar() or 0,
            "total_payments_due": float(payments[0] or 0),
            "total_payments_made": float(payments[1] or 0)
        }
    }


# ============ EXTERNAL REFERRALS ENDPOINTS ============

@router.get("/referrals")
async def list_external_referrals(
    status: Optional[str] = None,
    referral_doctor_id: Optional[int] = None,
    technician_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List external referrals with filters"""
    query = select(ExternalReferral)
    
    if status:
        query = query.where(ExternalReferral.status == status)
    if referral_doctor_id:
        query = query.where(ExternalReferral.referral_doctor_id == referral_doctor_id)
    if technician_id:
        query = query.where(ExternalReferral.technician_user_id == technician_id)
    if date_from:
        query = query.where(ExternalReferral.referral_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(ExternalReferral.referral_date <= datetime.combine(date_to, datetime.max.time()))
    
    query = query.order_by(desc(ExternalReferral.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    referrals = result.scalars().all()
    
    response = []
    for r in referrals:
        # Get referral doctor info
        doc_result = await db.execute(
            select(ReferralDoctor).where(ReferralDoctor.id == r.referral_doctor_id)
        )
        doctor = doc_result.scalar_one_or_none()
        
        # Get technician info
        tech_result = await db.execute(
            select(User).where(User.id == r.technician_user_id)
        )
        technician = tech_result.scalar_one_or_none()
        
        response.append({
            "id": r.id,
            "referral_number": r.referral_number,
            "client_name": r.client_name,
            "client_phone": r.client_phone,
            "client_email": r.client_email,
            "referral_doctor": {
                "id": doctor.id,
                "name": doctor.name,
                "clinic_name": doctor.clinic_name
            } if doctor else None,
            "technician": {
                "id": technician.id,
                "name": f"{technician.first_name} {technician.last_name}"
            } if technician else None,
            "referral_date": r.referral_date.isoformat() if r.referral_date else None,
            "reason": r.reason,
            "status": r.status,
            "service_fee": float(r.service_fee or 0),
            "patient_id": r.patient_id,
            "created_at": r.created_at.isoformat() if r.created_at else None
        })
    
    return response


@router.post("/referrals")
async def create_external_referral(
    data: ExternalReferralCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new external referral"""
    # Verify referral doctor exists
    doc_result = await db.execute(
        select(ReferralDoctor).where(ReferralDoctor.id == data.referral_doctor_id)
    )
    if not doc_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Referral doctor not found")
    
    referral_number = await generate_referral_number(db)
    
    referral = ExternalReferral(
        referral_number=referral_number,
        client_name=data.client_name,
        client_phone=data.client_phone,
        client_email=data.client_email,
        client_address=data.client_address,
        client_dob=data.client_dob,
        client_sex=data.client_sex,
        referral_doctor_id=data.referral_doctor_id,
        technician_user_id=current_user.id,
        branch_id=current_user.branch_id,
        reason=data.reason,
        notes=data.notes,
        service_fee=data.service_fee or 0,
        status="pending"
    )
    db.add(referral)
    await db.commit()
    await db.refresh(referral)
    
    # Auto-create payment record based on settings
    await create_referral_payment_record(db, referral, current_user)
    
    return {
        "id": referral.id,
        "referral_number": referral.referral_number,
        "message": "External referral created successfully"
    }


async def create_referral_payment_record(db: AsyncSession, referral: ExternalReferral, current_user: User):
    """Create payment record based on payment settings"""
    # Get payment setting for this doctor or default
    setting_result = await db.execute(
        select(ReferralPaymentSetting)
        .where(
            and_(
                ReferralPaymentSetting.is_active == True,
                or_(
                    ReferralPaymentSetting.referral_doctor_id == referral.referral_doctor_id,
                    ReferralPaymentSetting.referral_doctor_id == None
                )
            )
        )
        .order_by(ReferralPaymentSetting.referral_doctor_id.desc())  # Prefer doctor-specific
    )
    setting = setting_result.scalar_one_or_none()
    
    if not setting or not referral.service_fee:
        return  # No payment setting or no service fee
    
    # Calculate payment amount
    if setting.payment_type == "percentage":
        amount = float(referral.service_fee) * float(setting.rate) / 100
    else:
        amount = float(setting.rate)
    
    payment_number = await generate_payment_number(db)
    
    payment = ReferralPayment(
        payment_number=payment_number,
        referral_doctor_id=referral.referral_doctor_id,
        external_referral_id=referral.id,
        service_amount=referral.service_fee,
        payment_type=setting.payment_type,
        payment_rate=setting.rate,
        amount=amount,
        is_paid=False
    )
    db.add(payment)
    await db.commit()


@router.get("/referrals/{referral_id}")
async def get_external_referral(
    referral_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single external referral with full details"""
    result = await db.execute(
        select(ExternalReferral).where(ExternalReferral.id == referral_id)
    )
    referral = result.scalar_one_or_none()
    
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    # Get referral doctor
    doc_result = await db.execute(
        select(ReferralDoctor).where(ReferralDoctor.id == referral.referral_doctor_id)
    )
    doctor = doc_result.scalar_one_or_none()
    
    # Get technician
    tech_result = await db.execute(
        select(User).where(User.id == referral.technician_user_id)
    )
    technician = tech_result.scalar_one_or_none()
    
    # Get scans
    scans_result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.external_referral_id == referral_id)
    )
    scans = scans_result.scalars().all()
    
    # Get payment
    payment_result = await db.execute(
        select(ReferralPayment).where(ReferralPayment.external_referral_id == referral_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    return {
        "id": referral.id,
        "referral_number": referral.referral_number,
        "client_name": referral.client_name,
        "client_phone": referral.client_phone,
        "client_email": referral.client_email,
        "client_address": referral.client_address,
        "client_dob": referral.client_dob.isoformat() if referral.client_dob else None,
        "client_sex": referral.client_sex,
        "patient_id": referral.patient_id,
        "referral_doctor": {
            "id": doctor.id,
            "name": doctor.name,
            "phone": doctor.phone,
            "clinic_name": doctor.clinic_name
        } if doctor else None,
        "technician": {
            "id": technician.id,
            "name": f"{technician.first_name} {technician.last_name}"
        } if technician else None,
        "referral_date": referral.referral_date.isoformat() if referral.referral_date else None,
        "reason": referral.reason,
        "notes": referral.notes,
        "status": referral.status,
        "service_fee": float(referral.service_fee or 0),
        "scans": [
            {
                "id": s.id,
                "scan_number": s.scan_number,
                "scan_type": s.scan_type,
                "status": s.status,
                "scan_date": s.scan_date.isoformat() if s.scan_date else None
            }
            for s in scans
        ],
        "payment": {
            "id": payment.id,
            "amount": float(payment.amount),
            "is_paid": payment.is_paid,
            "payment_date": payment.payment_date.isoformat() if payment.payment_date else None
        } if payment else None,
        "created_at": referral.created_at.isoformat() if referral.created_at else None
    }


@router.put("/referrals/{referral_id}")
async def update_external_referral(
    referral_id: int,
    data: ExternalReferralUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an external referral"""
    result = await db.execute(
        select(ExternalReferral).where(ExternalReferral.id == referral_id)
    )
    referral = result.scalar_one_or_none()
    
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    for field, value in data.dict(exclude_unset=True).items():
        setattr(referral, field, value)
    
    referral.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Referral updated successfully"}


@router.post("/referrals/{referral_id}/convert-to-patient")
async def convert_referral_to_patient(
    referral_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Convert external referral client to a full patient record"""
    result = await db.execute(
        select(ExternalReferral).where(ExternalReferral.id == referral_id)
    )
    referral = result.scalar_one_or_none()
    
    if not referral:
        raise HTTPException(status_code=404, detail="Referral not found")
    
    if referral.patient_id:
        raise HTTPException(status_code=400, detail="Referral already linked to a patient")
    
    # Generate patient number
    today = datetime.now().strftime("%Y%m%d")
    count_result = await db.execute(
        select(func.count(Patient.id))
        .where(Patient.patient_number.like(f"PT-{today}%"))
    )
    count = count_result.scalar() or 0
    patient_number = f"PT-{today}-{str(count + 1).zfill(3)}"
    
    # Parse name
    name_parts = referral.client_name.split(" ", 1)
    first_name = name_parts[0]
    last_name = name_parts[1] if len(name_parts) > 1 else ""
    
    # Create patient
    patient = Patient(
        patient_number=patient_number,
        first_name=first_name,
        last_name=last_name,
        phone=referral.client_phone,
        email=referral.client_email,
        address=referral.client_address,
        date_of_birth=referral.client_dob,
        sex=referral.client_sex,
        branch_id=referral.branch_id
    )
    db.add(patient)
    await db.flush()
    
    # Link referral to patient
    referral.patient_id = patient.id
    
    # Update any scans to link to patient
    await db.execute(
        select(TechnicianScan)
        .where(TechnicianScan.external_referral_id == referral_id)
    )
    
    from sqlalchemy import update
    await db.execute(
        update(TechnicianScan)
        .where(TechnicianScan.external_referral_id == referral_id)
        .values(patient_id=patient.id)
    )
    
    await db.commit()
    
    return {
        "message": "Client converted to patient successfully",
        "patient_id": patient.id,
        "patient_number": patient_number
    }


# ============ TECHNICIAN SCANS ENDPOINTS ============

@router.get("/scans")
async def list_technician_scans(
    scan_type: Optional[str] = None,
    status: Optional[str] = None,
    patient_id: Optional[int] = None,
    visit_id: Optional[int] = None,
    external_referral_id: Optional[int] = None,
    performed_by_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    pending_review: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List technician scans with filters"""
    query = select(TechnicianScan)
    
    if scan_type and scan_type != 'all':
        query = query.where(TechnicianScan.scan_type == scan_type)
    if status and status != 'all':
        query = query.where(TechnicianScan.status == status)
    if patient_id:
        query = query.where(TechnicianScan.patient_id == patient_id)
    if visit_id:
        query = query.where(TechnicianScan.visit_id == visit_id)
    if external_referral_id:
        query = query.where(TechnicianScan.external_referral_id == external_referral_id)
    if performed_by_id:
        query = query.where(TechnicianScan.performed_by_id == performed_by_id)
    if date_from:
        query = query.where(TechnicianScan.scan_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(TechnicianScan.scan_date <= datetime.combine(date_to, datetime.max.time()))
    if pending_review:
        query = query.where(
            and_(
                TechnicianScan.status == "completed",
                TechnicianScan.reviewed_by_id == None
            )
        )
    
    query = query.order_by(desc(TechnicianScan.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    scans = result.scalars().all()
    
    response = []
    for s in scans:
        # Get performer info
        performer_result = await db.execute(
            select(User).where(User.id == s.performed_by_id)
        )
        performer = performer_result.scalar_one_or_none()
        
        # Get patient info if linked
        patient_info = None
        if s.patient_id:
            patient_result = await db.execute(
                select(Patient).where(Patient.id == s.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_info = {
                    "id": patient.id,
                    "name": f"{patient.first_name} {patient.last_name}",
                    "patient_number": patient.patient_number
                }
        
        # Get external referral client name if linked
        client_name = None
        if s.external_referral_id:
            ref_result = await db.execute(
                select(ExternalReferral).where(ExternalReferral.id == s.external_referral_id)
            )
            ref = ref_result.scalar_one_or_none()
            if ref:
                client_name = ref.client_name
        
        # Get scan price
        price_result = await db.execute(
            select(ScanPricing).where(ScanPricing.scan_type == s.scan_type)
        )
        pricing = price_result.scalar_one_or_none()
        
        # Get payment info
        payment_result = await db.execute(
            select(ScanPayment).where(ScanPayment.scan_id == s.id)
        )
        payment = payment_result.scalar_one_or_none()
        
        response.append({
            "id": s.id,
            "scan_number": s.scan_number,
            "scan_type": s.scan_type,
            "patient": patient_info,
            "client_name": client_name,
            "external_referral_id": s.external_referral_id,
            "visit_id": s.visit_id,
            "consultation_id": s.consultation_id,
            "performed_by": {
                "id": performer.id,
                "name": f"{performer.first_name} {performer.last_name}"
            } if performer else None,
            "scan_date": s.scan_date.isoformat() if s.scan_date else None,
            "status": s.status,
            "has_pdf": bool(s.pdf_file_path),
            "price": float(pricing.price) if pricing else 0,
            "payment": {
                "id": payment.id,
                "amount": float(payment.amount),
                "is_paid": payment.is_paid,
                "added_to_deficit": payment.added_to_deficit
            } if payment else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    
    return response


@router.post("/scans")
async def create_technician_scan(
    data: TechnicianScanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new technician scan record"""
    # Validate scan type
    valid_types = ["oct", "vft", "fundus", "pachymeter"]
    if data.scan_type.lower() not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid scan type. Must be one of: {valid_types}")
    
    scan_number = await generate_scan_number(db)
    
    scan = TechnicianScan(
        scan_number=scan_number,
        scan_type=data.scan_type.lower(),
        patient_id=data.patient_id,
        external_referral_id=data.external_referral_id,
        visit_id=data.visit_id,
        consultation_id=data.consultation_id,
        performed_by_id=current_user.id,
        branch_id=current_user.branch_id,
        od_results=data.od_results or {},
        os_results=data.os_results or {},
        results_summary=data.results_summary,
        notes=data.notes,
        status="pending"
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    
    return {
        "id": scan.id,
        "scan_number": scan.scan_number,
        "message": "Scan record created successfully"
    }


@router.get("/scans/{scan_id}")
async def get_technician_scan(
    scan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single scan with full details"""
    result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Get performer
    performer_result = await db.execute(
        select(User).where(User.id == scan.performed_by_id)
    )
    performer = performer_result.scalar_one_or_none()
    
    # Get reviewer if reviewed
    reviewer = None
    if scan.reviewed_by_id:
        reviewer_result = await db.execute(
            select(User).where(User.id == scan.reviewed_by_id)
        )
        reviewer = reviewer_result.scalar_one_or_none()
    
    # Get patient info
    patient_info = None
    if scan.patient_id:
        patient_result = await db.execute(
            select(Patient).where(Patient.id == scan.patient_id)
        )
        patient = patient_result.scalar_one_or_none()
        if patient:
            patient_info = {
                "id": patient.id,
                "name": f"{patient.first_name} {patient.last_name}",
                "patient_number": patient.patient_number
            }
    
    # Get external referral info
    referral_info = None
    if scan.external_referral_id:
        ref_result = await db.execute(
            select(ExternalReferral).where(ExternalReferral.id == scan.external_referral_id)
        )
        ref = ref_result.scalar_one_or_none()
        if ref:
            referral_info = {
                "id": ref.id,
                "referral_number": ref.referral_number,
                "client_name": ref.client_name
            }
    
    # Get payment info
    payment_info = None
    payment_result = await db.execute(
        select(ScanPayment).where(ScanPayment.scan_id == scan_id)
    )
    payment = payment_result.scalar_one_or_none()
    if payment:
        payment_info = {
            "id": payment.id,
            "amount": float(payment.amount) if payment.amount else 0,
            "is_paid": payment.is_paid,
            "payment_method": payment.payment_method,
            "payment_date": payment.payment_date.isoformat() if payment.payment_date else None,
            "added_to_deficit": payment.added_to_deficit,
            "notes": payment.notes
        }
    
    return {
        "id": scan.id,
        "scan_number": scan.scan_number,
        "scan_type": scan.scan_type,
        "patient": patient_info,
        "external_referral": referral_info,
        "visit_id": scan.visit_id,
        "consultation_id": scan.consultation_id,
        "performed_by": {
            "id": performer.id,
            "name": f"{performer.first_name} {performer.last_name}"
        } if performer else None,
        "scan_date": scan.scan_date.isoformat() if scan.scan_date else None,
        "od_results": scan.od_results,
        "os_results": scan.os_results,
        "results_summary": scan.results_summary,
        "pdf_file_path": scan.pdf_file_path,
        "notes": scan.notes,
        "status": scan.status,
        "reviewed_by": {
            "id": reviewer.id,
            "name": f"{reviewer.first_name} {reviewer.last_name}"
        } if reviewer else None,
        "reviewed_at": scan.reviewed_at.isoformat() if scan.reviewed_at else None,
        "doctor_notes": scan.doctor_notes,
        "payment": payment_info,
        "created_at": scan.created_at.isoformat() if scan.created_at else None
    }


@router.put("/scans/{scan_id}")
async def update_technician_scan(
    scan_id: int,
    data: TechnicianScanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a scan record"""
    result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    for field, value in data.dict(exclude_unset=True).items():
        setattr(scan, field, value)
    
    scan.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Scan updated successfully"}


@router.post("/scans/{scan_id}/complete")
async def complete_scan(
    scan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a scan as completed"""
    from app.models.communication import Notification
    
    result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan.status = "completed"
    scan.updated_at = datetime.utcnow()
    
    # Notify the requesting doctor if this was a doctor-requested scan
    if scan.requested_by_id:
        # Get patient name for notification
        patient_name = "Patient"
        if scan.patient_id:
            patient_result = await db.execute(
                select(Patient).where(Patient.id == scan.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_name = f"{patient.first_name} {patient.last_name}"
        
        notification = Notification(
            user_id=scan.requested_by_id,
            title="Scan Completed",
            message=f"{scan.scan_type.upper()} scan for {patient_name} has been completed and is ready for review.",
            notification_type="scan_completed",
            reference_type="scan",
            reference_id=scan.id
        )
        db.add(notification)
    
    await db.commit()
    
    return {"message": "Scan marked as completed"}


@router.post("/scans/{scan_id}/review")
async def review_scan(
    scan_id: int,
    doctor_notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Doctor reviews a scan"""
    result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    scan.status = "reviewed"
    scan.reviewed_by_id = current_user.id
    scan.reviewed_at = datetime.utcnow()
    if doctor_notes:
        scan.doctor_notes = doctor_notes
    scan.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Scan reviewed successfully"}


@router.post("/scans/{scan_id}/upload-pdf")
async def upload_scan_pdf(
    scan_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload PDF results for a scan"""
    result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")
    
    # Use absolute path for uploads directory
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))
    upload_dir = os.path.join(base_dir, "uploads", "scans")
    
    try:
        os.makedirs(upload_dir, exist_ok=True)
    except PermissionError:
        # Fallback to /tmp if main directory is not writable
        upload_dir = os.path.join("/tmp", "kountryeye", "uploads", "scans")
        os.makedirs(upload_dir, exist_ok=True)
    
    # Save file
    filename = f"{scan.scan_number}_{datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except PermissionError:
        raise HTTPException(status_code=500, detail="Permission denied: Unable to save file. Please contact administrator.")
    
    scan.pdf_file_path = file_path
    scan.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "PDF uploaded successfully", "file_path": file_path}


@router.get("/scans/{scan_id}/pdf")
async def get_scan_pdf(
    scan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download/view PDF for a scan"""
    result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    if not scan.pdf_file_path:
        raise HTTPException(status_code=404, detail="No PDF uploaded for this scan")
    
    if not os.path.exists(scan.pdf_file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on server")
    
    return FileResponse(
        scan.pdf_file_path,
        media_type="application/pdf",
        filename=f"{scan.scan_number}.pdf"
    )


@router.get("/patient/{patient_id}/scans")
async def get_patient_scans(
    patient_id: int,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all scans for a patient (including scans from external referrals linked to this patient)"""
    # Get referral IDs linked to this patient
    referral_ids_query = select(ExternalReferral.id).where(ExternalReferral.patient_id == patient_id)
    referral_ids_result = await db.execute(referral_ids_query)
    referral_ids = [r[0] for r in referral_ids_result.fetchall()]
    
    # Query scans by patient_id OR external_referral_id
    if referral_ids:
        query = select(TechnicianScan).where(
            or_(
                TechnicianScan.patient_id == patient_id,
                TechnicianScan.external_referral_id.in_(referral_ids)
            )
        )
    else:
        query = select(TechnicianScan).where(TechnicianScan.patient_id == patient_id)
    
    if status:
        query = query.where(TechnicianScan.status == status)
    
    query = query.order_by(desc(TechnicianScan.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    scans = result.scalars().all()
    
    response = []
    for s in scans:
        # Get payment info
        payment_result = await db.execute(
            select(ScanPayment).where(ScanPayment.scan_id == s.id)
        )
        payment = payment_result.scalar_one_or_none()
        
        # Get scan price
        price_result = await db.execute(
            select(ScanPricing).where(ScanPricing.scan_type == s.scan_type)
        )
        pricing = price_result.scalar_one_or_none()
        
        response.append({
            "id": s.id,
            "scan_number": s.scan_number,
            "scan_type": s.scan_type,
            "scan_date": s.scan_date.isoformat() if s.scan_date else None,
            "status": s.status,
            "results_summary": s.results_summary,
            "has_pdf": bool(s.pdf_file_path),
            "price": float(pricing.price) if pricing else 0,
            "payment": {
                "is_paid": payment.is_paid if payment else False,
                "payment_method": payment.payment_method if payment else None,
            } if payment else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    
    return response


@router.post("/scans/request")
async def request_scan(
    patient_id: int,
    scan_type: str,
    visit_id: Optional[int] = None,
    consultation_id: Optional[int] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Doctor requests a scan for a patient"""
    valid_types = ["oct", "vft", "fundus", "pachymeter"]
    if scan_type.lower() not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid scan type. Must be one of: {valid_types}")
    
    scan_number = await generate_scan_number(db)
    
    scan = TechnicianScan(
        scan_number=scan_number,
        scan_type=scan_type.lower(),
        patient_id=patient_id,
        visit_id=visit_id,
        consultation_id=consultation_id,
        performed_by_id=current_user.id,  # Will be updated when technician performs
        branch_id=current_user.branch_id,
        requested_by_id=current_user.id,
        requested_at=datetime.utcnow(),
        notes=notes,
        status="pending"
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    
    return {
        "id": scan.id,
        "scan_number": scan.scan_number,
        "message": "Scan requested successfully"
    }


# ============ PAYMENT SETTINGS ENDPOINTS ============

@router.get("/payment-settings")
async def list_payment_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all payment settings"""
    result = await db.execute(
        select(ReferralPaymentSetting)
        .where(ReferralPaymentSetting.is_active == True)
        .order_by(ReferralPaymentSetting.referral_doctor_id.desc())
    )
    settings = result.scalars().all()
    
    response = []
    for s in settings:
        doctor_name = "Default (All Doctors)"
        if s.referral_doctor_id:
            doc_result = await db.execute(
                select(ReferralDoctor).where(ReferralDoctor.id == s.referral_doctor_id)
            )
            doctor = doc_result.scalar_one_or_none()
            if doctor:
                doctor_name = doctor.name
        
        response.append({
            "id": s.id,
            "referral_doctor_id": s.referral_doctor_id,
            "doctor_name": doctor_name,
            "payment_type": s.payment_type,
            "rate": float(s.rate),
            "effective_from": s.effective_from.isoformat() if s.effective_from else None,
            "effective_to": s.effective_to.isoformat() if s.effective_to else None,
            "is_active": s.is_active
        })
    
    return response


@router.post("/payment-settings")
async def create_payment_setting(
    data: PaymentSettingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new payment setting"""
    # Deactivate existing setting for same doctor
    from sqlalchemy import update
    await db.execute(
        update(ReferralPaymentSetting)
        .where(
            and_(
                ReferralPaymentSetting.referral_doctor_id == data.referral_doctor_id,
                ReferralPaymentSetting.is_active == True
            )
        )
        .values(is_active=False, effective_to=date.today())
    )
    
    setting = ReferralPaymentSetting(
        referral_doctor_id=data.referral_doctor_id,
        payment_type=data.payment_type,
        rate=data.rate,
        effective_from=data.effective_from or date.today(),
        created_by_id=current_user.id
    )
    db.add(setting)
    await db.commit()
    
    return {"message": "Payment setting created successfully"}


# ============ PAYMENTS ENDPOINTS ============

@router.get("/payments")
async def list_referral_payments(
    is_paid: Optional[bool] = None,
    referral_doctor_id: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List referral payments with filters"""
    query = select(ReferralPayment)
    
    if is_paid is not None:
        query = query.where(ReferralPayment.is_paid == is_paid)
    if referral_doctor_id:
        query = query.where(ReferralPayment.referral_doctor_id == referral_doctor_id)
    if date_from:
        query = query.where(ReferralPayment.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(ReferralPayment.created_at <= datetime.combine(date_to, datetime.max.time()))
    
    query = query.order_by(desc(ReferralPayment.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    payments = result.scalars().all()
    
    response = []
    for p in payments:
        # Get doctor info
        doc_result = await db.execute(
            select(ReferralDoctor).where(ReferralDoctor.id == p.referral_doctor_id)
        )
        doctor = doc_result.scalar_one_or_none()
        
        response.append({
            "id": p.id,
            "payment_number": p.payment_number,
            "referral_doctor": {
                "id": doctor.id,
                "name": doctor.name,
                "clinic_name": doctor.clinic_name
            } if doctor else None,
            "external_referral_id": p.external_referral_id,
            "service_amount": float(p.service_amount or 0),
            "payment_type": p.payment_type,
            "payment_rate": float(p.payment_rate or 0),
            "amount": float(p.amount),
            "is_paid": p.is_paid,
            "payment_method": p.payment_method,
            "payment_date": p.payment_date.isoformat() if p.payment_date else None,
            "reference_number": p.reference_number,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    
    return response


@router.put("/payments/{payment_id}")
async def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a payment (mark as paid, add details)"""
    result = await db.execute(
        select(ReferralPayment).where(ReferralPayment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    for field, value in data.dict(exclude_unset=True).items():
        setattr(payment, field, value)
    
    if data.is_paid and not payment.paid_by_id:
        payment.paid_by_id = current_user.id
        if not payment.payment_date:
            payment.payment_date = datetime.utcnow()
    
    payment.updated_at = datetime.utcnow()
    await db.commit()
    
    return {"message": "Payment updated successfully"}


@router.post("/payments/{payment_id}/mark-paid")
async def mark_payment_paid(
    payment_id: int,
    payment_method: str,
    reference_number: Optional[str] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Quick endpoint to mark a payment as paid"""
    result = await db.execute(
        select(ReferralPayment).where(ReferralPayment.id == payment_id)
    )
    payment = result.scalar_one_or_none()
    
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    
    payment.is_paid = True
    payment.payment_method = payment_method
    payment.payment_date = datetime.utcnow()
    payment.reference_number = reference_number
    payment.notes = notes
    payment.paid_by_id = current_user.id
    payment.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {"message": "Payment marked as paid"}


# ============ ANALYTICS ENDPOINTS ============

@router.get("/analytics/top-referrers")
async def get_top_referrers(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get top referring doctors by referral count"""
    query = select(
        ReferralDoctor.id,
        ReferralDoctor.name,
        ReferralDoctor.clinic_name,
        func.count(ExternalReferral.id).label("referral_count"),
        func.sum(ExternalReferral.service_fee).label("total_revenue")
    ).join(
        ExternalReferral, ExternalReferral.referral_doctor_id == ReferralDoctor.id
    ).group_by(ReferralDoctor.id)
    
    if date_from:
        query = query.where(ExternalReferral.referral_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.where(ExternalReferral.referral_date <= datetime.combine(date_to, datetime.max.time()))
    
    query = query.order_by(desc("referral_count")).limit(limit)
    result = await db.execute(query)
    
    return [
        {
            "doctor_id": row[0],
            "doctor_name": row[1],
            "clinic_name": row[2],
            "referral_count": row[3],
            "total_revenue": float(row[4] or 0)
        }
        for row in result.all()
    ]


@router.get("/analytics/summary")
async def get_referral_summary(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get summary statistics for referrals"""
    # Build date filter
    date_filter = []
    if date_from:
        date_filter.append(ExternalReferral.referral_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        date_filter.append(ExternalReferral.referral_date <= datetime.combine(date_to, datetime.max.time()))
    
    # Total referrals
    referral_query = select(func.count(ExternalReferral.id))
    if date_filter:
        referral_query = referral_query.where(and_(*date_filter))
    total_referrals = (await db.execute(referral_query)).scalar() or 0
    
    # Total revenue
    revenue_query = select(func.sum(ExternalReferral.service_fee))
    if date_filter:
        revenue_query = revenue_query.where(and_(*date_filter))
    total_revenue = float((await db.execute(revenue_query)).scalar() or 0)
    
    # Total scans
    scan_filter = []
    if date_from:
        scan_filter.append(TechnicianScan.scan_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        scan_filter.append(TechnicianScan.scan_date <= datetime.combine(date_to, datetime.max.time()))
    
    scan_query = select(func.count(TechnicianScan.id))
    if scan_filter:
        scan_query = scan_query.where(and_(*scan_filter))
    total_scans = (await db.execute(scan_query)).scalar() or 0
    
    # Scans by type
    scan_type_query = select(
        TechnicianScan.scan_type,
        func.count(TechnicianScan.id)
    ).group_by(TechnicianScan.scan_type)
    if scan_filter:
        scan_type_query = scan_type_query.where(and_(*scan_filter))
    scan_types = (await db.execute(scan_type_query)).all()
    
    # Pending payments
    pending_query = select(
        func.count(ReferralPayment.id),
        func.sum(ReferralPayment.amount)
    ).where(ReferralPayment.is_paid == False)
    pending_result = (await db.execute(pending_query)).first()
    
    # Paid payments
    paid_query = select(func.sum(ReferralPayment.amount)).where(ReferralPayment.is_paid == True)
    if date_from:
        paid_query = paid_query.where(ReferralPayment.payment_date >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        paid_query = paid_query.where(ReferralPayment.payment_date <= datetime.combine(date_to, datetime.max.time()))
    total_paid = float((await db.execute(paid_query)).scalar() or 0)
    
    return {
        "total_referrals": total_referrals,
        "total_revenue": total_revenue,
        "total_scans": total_scans,
        "scans_by_type": {row[0]: row[1] for row in scan_types},
        "pending_payments": {
            "count": pending_result[0] or 0,
            "amount": float(pending_result[1] or 0)
        },
        "total_paid": total_paid
    }


# ============ PATIENT SCANS FOR DOCTORS ============

@router.get("/patient/{patient_id}/scans")
async def get_patient_scans(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all scans for a patient - for doctor consultation view"""
    result = await db.execute(
        select(TechnicianScan)
        .where(TechnicianScan.patient_id == patient_id)
        .order_by(desc(TechnicianScan.scan_date))
    )
    scans = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "scan_number": s.scan_number,
            "scan_type": s.scan_type,
            "scan_date": s.scan_date.isoformat() if s.scan_date else None,
            "od_results": s.od_results,
            "os_results": s.os_results,
            "results_summary": s.results_summary,
            "pdf_file_path": s.pdf_file_path,
            "status": s.status,
            "notes": s.notes,
            "doctor_notes": s.doctor_notes,
            "visit_id": s.visit_id,
            "consultation_id": s.consultation_id
        }
        for s in scans
    ]


@router.get("/consultation/{consultation_id}/scans")
async def get_consultation_scans(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get scans linked to a specific consultation"""
    result = await db.execute(
        select(TechnicianScan)
        .where(TechnicianScan.consultation_id == consultation_id)
        .order_by(desc(TechnicianScan.scan_date))
    )
    scans = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "scan_number": s.scan_number,
            "scan_type": s.scan_type,
            "scan_date": s.scan_date.isoformat() if s.scan_date else None,
            "od_results": s.od_results,
            "os_results": s.os_results,
            "results_summary": s.results_summary,
            "pdf_file_path": s.pdf_file_path,
            "status": s.status,
            "notes": s.notes,
            "doctor_notes": s.doctor_notes
        }
        for s in scans
    ]


# ============ SCAN REQUESTS (FROM DOCTORS) ============

@router.get("/scan-requests")
async def list_scan_requests(
    status: Optional[str] = None,
    scan_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List scan requests from doctors - scans with requested_by_id set"""
    query = select(TechnicianScan).where(TechnicianScan.requested_by_id != None)
    
    if status and status != 'all':
        query = query.where(TechnicianScan.status == status)
    if scan_type:
        query = query.where(TechnicianScan.scan_type == scan_type)
    
    query = query.order_by(desc(TechnicianScan.requested_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    scans = result.scalars().all()
    
    response = []
    for s in scans:
        # Get patient info
        patient_info = None
        if s.patient_id:
            patient_result = await db.execute(
                select(Patient).where(Patient.id == s.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_info = {
                    "id": patient.id,
                    "name": f"{patient.first_name} {patient.last_name}",
                    "patient_number": patient.patient_number,
                    "phone": patient.phone
                }
        
        # Get requesting doctor info
        doctor_info = None
        if s.requested_by_id:
            doctor_result = await db.execute(
                select(User).where(User.id == s.requested_by_id)
            )
            doctor = doctor_result.scalar_one_or_none()
            if doctor:
                doctor_info = {
                    "id": doctor.id,
                    "name": f"{doctor.first_name} {doctor.last_name}"
                }
        
        # Get payment info
        payment_result = await db.execute(
            select(ScanPayment).where(ScanPayment.scan_id == s.id)
        )
        payment = payment_result.scalar_one_or_none()
        
        # Get scan price
        price_result = await db.execute(
            select(ScanPricing).where(ScanPricing.scan_type == s.scan_type)
        )
        pricing = price_result.scalar_one_or_none()
        
        response.append({
            "id": s.id,
            "scan_number": s.scan_number,
            "scan_type": s.scan_type,
            "patient": patient_info,
            "requested_by": doctor_info,
            "requested_at": s.requested_at.isoformat() if s.requested_at else None,
            "visit_id": s.visit_id,
            "consultation_id": s.consultation_id,
            "status": s.status,
            "notes": s.notes,
            "price": float(pricing.price) if pricing else 0,
            "payment": {
                "id": payment.id,
                "amount": float(payment.amount),
                "is_paid": payment.is_paid,
                "payment_method": payment.payment_method,
                "payment_date": payment.payment_date.isoformat() if payment.payment_date else None
            } if payment else None,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })
    
    return response


# ============ SCAN PRICING ============

@router.get("/scan-pricing")
async def list_scan_pricing(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all scan pricing"""
    result = await db.execute(
        select(ScanPricing).where(ScanPricing.is_active == True)
    )
    pricing = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "scan_type": p.scan_type,
            "price": float(p.price),
            "description": p.description,
            "is_active": p.is_active
        }
        for p in pricing
    ]


@router.put("/scan-pricing/{scan_type}")
async def update_scan_pricing(
    scan_type: str,
    price: float,
    description: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update scan pricing - admin/technician only"""
    result = await db.execute(
        select(ScanPricing).where(ScanPricing.scan_type == scan_type)
    )
    pricing = result.scalar_one_or_none()
    
    if not pricing:
        # Create new pricing
        pricing = ScanPricing(
            scan_type=scan_type,
            price=price,
            description=description,
            created_by_id=current_user.id
        )
        db.add(pricing)
    else:
        pricing.price = price
        if description:
            pricing.description = description
        pricing.updated_at = datetime.utcnow()
    
    await db.commit()
    return {"message": "Scan pricing updated successfully"}


# ============ SCAN PAYMENTS ============

@router.post("/scans/{scan_id}/payment")
async def create_scan_payment(
    scan_id: int,
    is_paid: bool = False,
    payment_method: Optional[str] = None,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create or update payment record for a scan"""
    from decimal import Decimal
    from app.models.patient import Visit
    
    # Get scan with visit info
    scan_result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = scan_result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Get pricing - check if external referral first (use service_fee)
    scan_amount = Decimal("0")
    
    if scan.external_referral_id:
        # For external referrals, use the service_fee from the referral
        referral_result = await db.execute(
            select(ExternalReferral).where(ExternalReferral.id == scan.external_referral_id)
        )
        referral = referral_result.scalar_one_or_none()
        if referral and referral.service_fee:
            scan_amount = Decimal(str(referral.service_fee))
    
    # Fall back to scan pricing if no service fee or not external referral
    if scan_amount == 0:
        price_result = await db.execute(
            select(ScanPricing).where(ScanPricing.scan_type == scan.scan_type)
        )
        pricing = price_result.scalar_one_or_none()
        
        if not pricing:
            raise HTTPException(status_code=400, detail="No pricing set for this scan type")
        
        scan_amount = Decimal(str(pricing.price))
    
    insurance_covered = Decimal("0")
    patient_pays = scan_amount
    
    # Check if visit uses insurance and has remaining balance
    if scan.visit_id:
        visit_result = await db.execute(
            select(Visit).where(Visit.id == scan.visit_id)
        )
        visit = visit_result.scalar_one_or_none()
        
        if visit and visit.payment_type == "insurance" and visit.insurance_limit:
            insurance_limit = Decimal(str(visit.insurance_limit or 0))
            insurance_used = Decimal(str(visit.insurance_used or 0))
            insurance_remaining = insurance_limit - insurance_used
            
            if insurance_remaining > 0:
                # Deduct from insurance
                if scan_amount <= insurance_remaining:
                    insurance_covered = scan_amount
                    patient_pays = Decimal("0")
                else:
                    insurance_covered = insurance_remaining
                    patient_pays = scan_amount - insurance_remaining
                
                # Update visit insurance_used
                visit.insurance_used = insurance_used + insurance_covered
                if patient_pays > 0:
                    visit.patient_topup = Decimal(str(visit.patient_topup or 0)) + patient_pays
    
    # Check if payment already exists
    payment_result = await db.execute(
        select(ScanPayment).where(ScanPayment.scan_id == scan_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    actual_is_paid = is_paid or (patient_pays == 0 and insurance_covered > 0)
    
    was_already_paid = payment.is_paid if payment else False
    
    if payment:
        # Update existing payment
        payment.is_paid = actual_is_paid
        if actual_is_paid:
            payment.payment_method = payment_method or ("insurance" if insurance_covered > 0 else None)
            payment.payment_date = datetime.utcnow()
            payment.payment_status = "paid"
        payment.notes = notes
        payment.recorded_by_id = current_user.id
        payment.updated_at = datetime.utcnow()
    else:
        # Create new payment
        payment = ScanPayment(
            scan_id=scan_id,
            amount=float(scan_amount),
            is_paid=actual_is_paid,
            payment_method=payment_method or ("insurance" if insurance_covered > 0 else None),
            payment_date=datetime.utcnow() if actual_is_paid else None,
            payment_status="paid" if actual_is_paid else "pending",
            recorded_by_id=current_user.id
        )
        db.add(payment)
    
    # Record revenue if payment is being marked as paid (and wasn't already paid)
    if actual_is_paid and not was_already_paid and float(scan_amount) > 0:
        scan_type_labels = {
            "oct": "OCT Scan",
            "vft": "Visual Field Test",
            "fundus": "Fundus Photography",
            "pachymeter": "Pachymeter"
        }
        description = scan_type_labels.get(scan.scan_type, scan.scan_type.upper())
        
        # Get patient name if available
        patient_name = ""
        if scan.patient_id:
            patient_result = await db.execute(
                select(Patient).where(Patient.id == scan.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_name = f" - {patient.first_name} {patient.last_name}"
        
        actual_payment_method = payment_method or ("insurance" if insurance_covered > 0 else "cash")
        
        revenue = Revenue(
            category="service",
            description=f"{description}{patient_name}",
            amount=float(scan_amount),
            payment_method=actual_payment_method,
            reference_type="scan",
            reference_id=scan_id,
            patient_id=scan.patient_id,
            branch_id=current_user.branch_id,
            recorded_by_id=current_user.id,
            notes=f"Scan #{scan.scan_number}"
        )
        db.add(revenue)
    
    await db.commit()
    
    return {
        "message": "Payment recorded successfully",
        "is_paid": actual_is_paid,
        "amount": float(scan_amount),
        "insurance_covered": float(insurance_covered),
        "patient_pays": float(patient_pays)
    }


@router.post("/scans/{scan_id}/mark-paid")
async def mark_scan_paid(
    scan_id: int,
    payment_method: str,
    notes: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Mark a scan as paid"""
    # Get scan
    scan_result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = scan_result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    # Get pricing
    price_result = await db.execute(
        select(ScanPricing).where(ScanPricing.scan_type == scan.scan_type)
    )
    pricing = price_result.scalar_one_or_none()
    amount = float(pricing.price) if pricing else 0
    
    # Check if payment exists
    payment_result = await db.execute(
        select(ScanPayment).where(ScanPayment.scan_id == scan_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    was_already_paid = payment and payment.is_paid
    
    if payment:
        payment.is_paid = True
        payment.payment_method = payment_method
        payment.payment_date = datetime.utcnow()
        payment.notes = notes
        payment.recorded_by_id = current_user.id
        payment.updated_at = datetime.utcnow()
    else:
        payment = ScanPayment(
            scan_id=scan_id,
            amount=amount,
            is_paid=True,
            payment_method=payment_method,
            payment_date=datetime.utcnow(),
            recorded_by_id=current_user.id,
            notes=notes
        )
        db.add(payment)
    
    # Record in revenue if not already paid and amount > 0
    if not was_already_paid and amount > 0:
        scan_type_labels = {
            "oct": "OCT Scan",
            "vft": "Visual Field Test",
            "fundus": "Fundus Photography",
            "pachymeter": "Pachymeter"
        }
        description = scan_type_labels.get(scan.scan_type, scan.scan_type.upper())
        
        # Get patient name if available
        patient_name = ""
        if scan.patient_id:
            patient_result = await db.execute(
                select(Patient).where(Patient.id == scan.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_name = f" - {patient.first_name} {patient.last_name}"
        
        revenue = Revenue(
            category="service",
            description=f"{description}{patient_name}",
            amount=amount,
            payment_method=payment_method,
            reference_type="scan",
            reference_id=scan_id,
            patient_id=scan.patient_id,
            branch_id=current_user.branch_id,
            recorded_by_id=current_user.id,
            notes=f"Scan #{scan.scan_number}"
        )
        db.add(revenue)
    
    await db.commit()
    
    return {"message": "Scan marked as paid", "amount": amount}


@router.post("/scans/{scan_id}/add-to-deficit")
async def add_scan_to_deficit(
    scan_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Add unpaid scan amount to patient's visit deficit"""
    # Get scan
    scan_result = await db.execute(
        select(TechnicianScan).where(TechnicianScan.id == scan_id)
    )
    scan = scan_result.scalar_one_or_none()
    
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    if not scan.visit_id:
        raise HTTPException(status_code=400, detail="Scan is not linked to a visit")
    
    # Get visit
    visit_result = await db.execute(
        select(Visit).where(Visit.id == scan.visit_id)
    )
    visit = visit_result.scalar_one_or_none()
    
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Get pricing
    price_result = await db.execute(
        select(ScanPricing).where(ScanPricing.scan_type == scan.scan_type)
    )
    pricing = price_result.scalar_one_or_none()
    amount = float(pricing.price) if pricing else 0
    
    # Get or create payment record
    payment_result = await db.execute(
        select(ScanPayment).where(ScanPayment.scan_id == scan_id)
    )
    payment = payment_result.scalar_one_or_none()
    
    if payment and payment.added_to_deficit:
        raise HTTPException(status_code=400, detail="Already added to deficit")
    
    if not payment:
        payment = ScanPayment(
            scan_id=scan_id,
            amount=amount,
            is_paid=False,
            recorded_by_id=current_user.id
        )
        db.add(payment)
    
    # Add to visit deficit
    current_deficit = float(visit.deficit or 0)
    visit.deficit = current_deficit + amount
    
    # Mark as added to deficit
    payment.added_to_deficit = True
    payment.deficit_added_at = datetime.utcnow()
    payment.updated_at = datetime.utcnow()
    
    await db.commit()
    
    return {
        "message": f"GH₵ {amount} added to patient deficit",
        "amount": amount,
        "new_deficit": float(visit.deficit)
    }


@router.get("/scan-payments/unpaid")
async def list_unpaid_scan_payments(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """List all unpaid scan payments"""
    # Get scans that have payment records that are unpaid
    query = select(TechnicianScan, ScanPayment).join(
        ScanPayment, ScanPayment.scan_id == TechnicianScan.id
    ).where(ScanPayment.is_paid == False)
    
    query = query.order_by(desc(TechnicianScan.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    rows = result.all()
    
    response = []
    for scan, payment in rows:
        # Get patient info
        patient_info = None
        if scan.patient_id:
            patient_result = await db.execute(
                select(Patient).where(Patient.id == scan.patient_id)
            )
            patient = patient_result.scalar_one_or_none()
            if patient:
                patient_info = {
                    "id": patient.id,
                    "name": f"{patient.first_name} {patient.last_name}",
                    "patient_number": patient.patient_number
                }
        
        response.append({
            "scan_id": scan.id,
            "scan_number": scan.scan_number,
            "scan_type": scan.scan_type,
            "patient": patient_info,
            "visit_id": scan.visit_id,
            "amount": float(payment.amount),
            "added_to_deficit": payment.added_to_deficit,
            "created_at": scan.created_at.isoformat() if scan.created_at else None
        })
    
    return response
