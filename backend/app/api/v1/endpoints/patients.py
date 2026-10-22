from decimal import Decimal
from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
import csv
import io

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user, require_permission
from app.core.ratelimit import rate_limit
from app.models.user import User
from app.models.patient import Patient, Visit
from app.models.audit import AuditLog
from app.schemas.patient import (
    PatientCreate, PatientUpdate, PatientResponse,
    VisitCreate, VisitUpdate, VisitResponse
)

from app.services.billing import visit_money

router = APIRouter()


def generate_patient_number(branch_id: int, count: int) -> str:
    return f"KE-{branch_id:02d}-{count:06d}"


async def next_patient_number(db: AsyncSession, branch_id: int, count: int) -> str:
    """count+1 can already be taken (deleted or moved patients), so step past used numbers."""
    number = generate_patient_number(branch_id, count)
    while (await db.execute(select(Patient.id).where(Patient.patient_number == number))).first():
        count += 1
        number = generate_patient_number(branch_id, count)
    return number


@router.get("", response_model=List[PatientResponse])
async def get_patients(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Patient)
    
    if branch_id:
        query = query.where(Patient.branch_id == branch_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Patient.first_name.ilike(search_term),
                Patient.last_name.ilike(search_term),
                Patient.phone.ilike(search_term),
                Patient.patient_number.ilike(search_term)
            )
        )
    
    query = query.order_by(Patient.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/export", dependencies=[Depends(require_permission("analytics.view", "patients.delete"))])
async def export_patients(
    format: str = "csv",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export all patients as CSV or XLSX"""
    result = await db.execute(select(Patient).order_by(Patient.created_at.desc()))
    patients = result.scalars().all()
    
    if format.lower() == "xlsx":
        try:
            from openpyxl import Workbook
            
            wb = Workbook()
            ws = wb.active
            ws.title = "Patients"
            
            # Headers
            headers = ["Patient Number", "First Name", "Last Name", "Phone", "Email", "Gender", "Date of Birth", "Address", "Occupation", "Emergency Contact", "Emergency Phone", "Created At"]
            ws.append(headers)
            
            # Data
            for p in patients:
                ws.append([
                    p.patient_number,
                    p.first_name,
                    p.last_name,
                    p.phone or "",
                    p.email or "",
                    p.sex or "",
                    p.date_of_birth.strftime("%Y-%m-%d") if p.date_of_birth else "",
                    p.address or "",
                    p.occupation or "",
                    p.emergency_contact_name or "",
                    p.emergency_contact_phone or "",
                    p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else ""
                ])
            
            output = io.BytesIO()
            wb.save(output)
            output.seek(0)
            
            return StreamingResponse(
                output,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": "attachment; filename=patients.xlsx"}
            )
        except ImportError:
            format = "csv"
    
    # CSV export
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow(["Patient Number", "First Name", "Last Name", "Phone", "Email", "Gender", "Date of Birth", "Address", "Occupation", "Emergency Contact", "Emergency Phone", "Created At"])
    
    # Data
    for p in patients:
        writer.writerow([
            p.patient_number,
            p.first_name,
            p.last_name,
            p.phone or "",
            p.email or "",
            p.sex or "",
            p.date_of_birth.strftime("%Y-%m-%d") if p.date_of_birth else "",
            p.address or "",
            p.occupation or "",
            p.emergency_contact_name or "",
            p.emergency_contact_phone or "",
            p.created_at.strftime("%Y-%m-%d %H:%M") if p.created_at else ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=patients.csv"}
    )


@router.get("/duplicates")
async def check_duplicates(
    first_name: str,
    last_name: str,
    phone: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Patient).where(
        func.lower(Patient.first_name) == first_name.lower(),
        func.lower(Patient.last_name) == last_name.lower()
    )
    
    if phone:
        query = query.where(Patient.phone == phone)
    
    result = await db.execute(query)
    patients = result.scalars().all()
    
    return {
        "has_duplicates": len(patients) > 0,
        "potential_duplicates": [
            {
                "id": p.id,
                "patient_number": p.patient_number,
                "first_name": p.first_name,
                "last_name": p.last_name,
                "phone": p.phone
            }
            for p in patients
        ]
    }


@router.get("/search")
async def search_patients(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Split search query into words for multi-word name search
    search_words = q.strip().split()
    
    if len(search_words) == 1:
        # Single word - search across all fields
        search_term = f"%{search_words[0]}%"
        query = select(Patient).where(
            or_(
                Patient.first_name.ilike(search_term),
                Patient.last_name.ilike(search_term),
                Patient.phone.ilike(search_term),
                Patient.patient_number.ilike(search_term)
            )
        ).limit(20)
    else:
        # Multiple words - try matching first_name + last_name combination
        conditions = []
        for word in search_words:
            word_term = f"%{word}%"
            conditions.append(
                or_(
                    Patient.first_name.ilike(word_term),
                    Patient.last_name.ilike(word_term)
                )
            )
        # All words must match either first_name or last_name
        query = select(Patient).where(and_(*conditions)).limit(20)
    
    result = await db.execute(query)
    patients = result.scalars().all()
    
    return [
        {
            "id": p.id,
            "patient_number": p.patient_number,
            "first_name": p.first_name,
            "last_name": p.last_name,
            "phone": p.phone,
            "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
        }
        for p in patients
    ]


@router.get("/pending-registrations")
async def get_pending_registrations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all pending patient registrations for front desk review."""
    from app.models.patient import PendingRegistration
    
    result = await db.execute(
        select(PendingRegistration)
        .where(PendingRegistration.status == "pending")
        .order_by(PendingRegistration.created_at.desc())
    )
    registrations = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "first_name": r.first_name,
            "last_name": r.last_name,
            "other_names": r.other_names,
            "phone": r.phone,
            "email": r.email,
            "date_of_birth": str(r.date_of_birth) if r.date_of_birth else None,
            "sex": r.sex,
            "marital_status": r.marital_status,
            "address": r.address,
            "nationality": r.nationality,
            "occupation": r.occupation,
            "ghana_card": r.ghana_card,
            "emergency_contact_name": r.emergency_contact_name,
            "emergency_contact_phone": r.emergency_contact_phone,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in registrations
    ]


@router.get("/visits/search")
async def search_visits(
    q: str = Query("", description="Search query"),
    limit: int = Query(10, description="Max results"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Search visits by patient name or visit ID for @ mentions"""
    from sqlalchemy.orm import joinedload
    
    query = select(Visit).options(joinedload(Visit.patient))
    
    if q:
        # Try to parse as visit ID
        try:
            visit_id = int(q)
            query = query.where(Visit.id == visit_id)
        except ValueError:
            # Search by patient name
            query = query.join(Patient).where(
                or_(
                    Patient.first_name.ilike(f"%{q}%"),
                    Patient.last_name.ilike(f"%{q}%"),
                    Patient.patient_number.ilike(f"%{q}%")
                )
            )
    
    query = query.order_by(Visit.visit_date.desc()).limit(limit)
    
    result = await db.execute(query)
    visits = result.unique().scalars().all()
    
    return [
        {
            "id": v.id,
            "patient_name": f"{v.patient.first_name} {v.patient.last_name}" if v.patient else "Unknown",
            "patient_id": v.patient_id,
            "visit_date": v.visit_date.strftime("%Y-%m-%d") if v.visit_date else None,
            "status": v.status,
            "payment_status": v.payment_status,
        }
        for v in visits
    ]


@router.get("/visits")
async def get_visits(
    period: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get visits with optional date filtering"""
    from datetime import date as date_type, timedelta, datetime as datetime_type
    from sqlalchemy.orm import joinedload
    
    # Parse date strings if provided
    parsed_start_date = None
    parsed_end_date = None
    if start_date:
        try:
            parsed_start_date = datetime_type.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    if end_date:
        try:
            parsed_end_date = datetime_type.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    
    query = select(Visit).options(joinedload(Visit.patient), joinedload(Visit.consultation_type))
    
    # Handle period filter
    if period:
        today = date_type.today()
        if period == "today":
            query = query.where(func.date(Visit.visit_date) == today)
        elif period == "yesterday":
            yesterday = today - timedelta(days=1)
            query = query.where(func.date(Visit.visit_date) == yesterday)
        elif period == "week":
            week_start = today - timedelta(days=today.weekday())
            query = query.where(func.date(Visit.visit_date) >= week_start)
            query = query.where(func.date(Visit.visit_date) <= today)
        elif period == "month":
            month_start = today.replace(day=1)
            query = query.where(func.date(Visit.visit_date) >= month_start)
            query = query.where(func.date(Visit.visit_date) <= today)
    else:
        # Handle custom date range
        if parsed_start_date:
            query = query.where(func.date(Visit.visit_date) >= parsed_start_date)
        if parsed_end_date:
            query = query.where(func.date(Visit.visit_date) <= parsed_end_date)
    
    query = query.order_by(Visit.visit_date.desc())
    
    result = await db.execute(query)
    visits = result.unique().scalars().all()
    
    return [
        {
            "id": v.id,
            "visit_number": v.visit_number,
            "patient_id": v.patient_id,
            "patient_name": f"{v.patient.first_name} {v.patient.last_name}" if v.patient else "Unknown",
            "patient_number": v.patient.patient_number if v.patient else "",
            "visit_type": v.visit_type.value if hasattr(v.visit_type, 'value') else str(v.visit_type),
            "status": v.status,
            "consultation_type": v.consultation_type.name if v.consultation_type else "",
            **visit_money(v),
            "payment_status": v.payment_status or "unpaid",
            "visit_date": v.visit_date.isoformat() if v.visit_date else "",
        }
        for v in visits
    ]


@router.get("/{patient_id}", response_model=PatientResponse)
async def get_patient(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("", response_model=PatientResponse)
async def create_patient(
    patient_in: PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    # Check for duplicate phone number globally
    if patient_in.phone:
        phone_check = await db.execute(
            select(Patient).where(Patient.phone == patient_in.phone).limit(1)
        )
        existing_by_phone = phone_check.scalars().first()
        if existing_by_phone:
            raise HTTPException(
                status_code=400, 
                detail=f"A patient with phone number {patient_in.phone} already exists (Patient #{existing_by_phone.patient_number})"
            )
    
    # Check for duplicate ghana_card globally
    patient_data = patient_in.model_dump()
    ghana_card = patient_data.get('ghana_card')
    if ghana_card:
        ghana_card_check = await db.execute(
            select(Patient).where(Patient.ghana_card == ghana_card).limit(1)
        )
        existing_by_ghana_card = ghana_card_check.scalars().first()
        if existing_by_ghana_card:
            raise HTTPException(
                status_code=400, 
                detail=f"A patient with Ghana Card {ghana_card} already exists (Patient #{existing_by_ghana_card.patient_number})"
            )
    
    count_result = await db.execute(
        select(func.count(Patient.id)).where(Patient.branch_id == patient_in.branch_id)
    )
    count = count_result.scalar() + 1
    
    patient = Patient(
        **patient_data,
        patient_number=await next_patient_number(db, patient_in.branch_id, count)
    )
    db.add(patient)
    
    audit = AuditLog(
        user_id=current_user.id,
        action="CREATE",
        entity_type="Patient",
        entity_id=0,
        new_values=f"Created patient: {patient.first_name} {patient.last_name}"
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(patient)
    
    audit.entity_id = patient.id
    await db.commit()
    
    return patient


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: int,
    patient_in: PatientUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    for field, value in patient_in.model_dump(exclude_unset=True).items():
        setattr(patient, field, value)
    
    audit = AuditLog(
        user_id=current_user.id,
        action="UPDATE",
        entity_type="Patient",
        entity_id=patient_id,
        new_values=f"Updated patient: {patient.first_name} {patient.last_name}"
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(patient)
    return patient


@router.get("/{patient_id}/visits", response_model=List[VisitResponse])
async def get_patient_visits(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Visit).where(Visit.patient_id == patient_id).order_by(Visit.visit_date.desc())
    )
    return result.scalars().all()


@router.get("/{patient_id}/balance")
async def get_patient_balance(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """What the patient owes across visits, prescriptions, scans and sales"""
    from app.services.balances import patient_charges
    charges = await patient_charges(db, patient_id)
    total_billed = sum((c.total for c in charges), Decimal("0"))
    total_paid = sum((c.paid for c in charges), Decimal("0"))
    return {
        "patient_id": patient_id,
        "total_billed": float(total_billed),
        "total_paid": float(total_paid),
        "balance": float(sum((c.balance for c in charges), Decimal("0"))),
        "visits_count": len([c for c in charges if c.kind == "consultation"]),
        "unpaid_visits": len([c for c in charges if c.kind == "consultation" and c.balance > 0]),
        "items": [
            {"kind": c.kind, "id": c.id, "label": c.label, "total": float(c.total), "paid": float(c.paid), "balance": float(c.balance)}
            for c in charges if c.balance > 0
        ],
    }


def generate_visit_number(branch_id: int, count: int) -> str:
    from datetime import date
    today = date.today()
    return f"V-{branch_id:02d}-{today.strftime('%Y%m%d')}-{count:04d}"


@router.get("/{patient_id}/detect-visit-type")
async def detect_visit_type(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Intelligently detect visit type based on patient history:
    - INITIAL: First ever visit for this patient
    - REVIEW: Visit within review_period_days of last visit (default 7 days)
    - SUBSEQUENT: Any other return visit
    """
    from app.models.settings import VisitFeeSettings
    from datetime import timedelta
    
    # Get patient
    result = await db.execute(select(Patient).where(Patient.id == patient_id))
    patient = result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get visit fee settings for review period
    settings_result = await db.execute(
        select(VisitFeeSettings).where(
            or_(
                VisitFeeSettings.branch_id == patient.branch_id,
                VisitFeeSettings.branch_id == None
            )
        ).order_by(VisitFeeSettings.branch_id.desc())
    )
    settings = settings_result.scalar_one_or_none()
    review_period_days = settings.review_period_days if settings else 7
    
    # Get patient's previous visits
    visits_result = await db.execute(
        select(Visit)
        .where(Visit.patient_id == patient_id)
        .order_by(Visit.visit_date.desc())
    )
    visits = visits_result.scalars().all()
    
    if not visits:
        # No previous visits - this is initial
        return {
            "visit_type": "initial",
            "reason": "First visit for this patient",
            "previous_visits_count": 0,
            "last_visit_date": None,
            "review_period_days": review_period_days
        }
    
    last_visit = visits[0]
    last_visit_date = last_visit.visit_date
    
    if last_visit_date:
        days_since_last = (datetime.now() - last_visit_date).days
        
        if days_since_last <= review_period_days:
            return {
                "visit_type": "review",
                "reason": f"Within {review_period_days} days of last visit ({days_since_last} days ago)",
                "previous_visits_count": len(visits),
                "last_visit_date": last_visit_date.isoformat(),
                "days_since_last_visit": days_since_last,
                "review_period_days": review_period_days
            }
    
    # More than review period - subsequent visit
    return {
        "visit_type": "subsequent",
        "reason": f"Return visit after review period",
        "previous_visits_count": len(visits),
        "last_visit_date": last_visit_date.isoformat() if last_visit_date else None,
        "days_since_last_visit": (datetime.now() - last_visit_date).days if last_visit_date else None,
        "review_period_days": review_period_days
    }


async def resolve_consultation_fee(db, ct, visit_type, payment_type, insurance_provider):
    """Fee for a visit: the type's base fee, or the insurer's override for insured visits.
    Mirrors what the booking screen shows, so the bill matches what staff saw."""
    from decimal import Decimal
    from app.models.insurance import InsuranceCompany, InsuranceFeeOverride
    fee = Decimal(str(ct.base_fee or 0))
    if payment_type != "insurance" or not insurance_provider:
        return fee
    company = (await db.execute(
        select(InsuranceCompany).where(InsuranceCompany.name == insurance_provider).limit(1)
    )).scalars().first()
    if not company:
        return fee
    override = (await db.execute(
        select(InsuranceFeeOverride).where(
            InsuranceFeeOverride.insurance_company_id == company.id,
            InsuranceFeeOverride.consultation_type_id == ct.id,
        ).limit(1)
    )).scalars().first()
    if not override:
        return fee
    vt = getattr(visit_type, "value", visit_type)
    by_type = {"initial": override.initial_fee, "review": override.review_fee, "subsequent": override.subsequent_fee}.get(vt)
    if by_type is not None:
        return Decimal(str(by_type))
    if override.override_fee is not None:
        return Decimal(str(override.override_fee))
    return fee


@router.post("/visits", response_model=VisitResponse)
async def create_visit(
    visit_in: VisitCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.clinical import ConsultationType
    from app.models.settings import VisionCareMember
    from decimal import Decimal
    
    patient_result = await db.execute(select(Patient).where(Patient.id == visit_in.patient_id))
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Get consultation fee if consultation_type_id provided
    consultation_fee = Decimal("0")
    visit_data = visit_in.model_dump()
    consultation_type_id = visit_data.pop('consultation_type_id', None)
    payment_type = visit_data.get('payment_type', 'cash')
    
    if consultation_type_id:
        ct_result = await db.execute(select(ConsultationType).where(ConsultationType.id == consultation_type_id))
        ct = ct_result.scalar_one_or_none()
        if ct:
            consultation_fee = await resolve_consultation_fee(
                db, ct, visit_data.get('visit_type'), payment_type, visit_data.get('insurance_provider')
            )
    
    # VAT goes on top of the fee; insurance and VisionCare cover the VAT-inclusive amount
    from app.services.vat import get_vat_rate, vat_on, vat_share
    vat_rate = await get_vat_rate(db)
    vat_amount = vat_on(consultation_fee, vat_rate)
    gross_fee = consultation_fee + vat_amount

    # Generate visit number
    from datetime import date
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    count_result = await db.execute(
        select(func.count(Visit.id)).where(
            Visit.branch_id == patient.branch_id,
            Visit.visit_date >= today_start
        )
    )
    count = count_result.scalar() + 1
    
    # Determine payment status and amount based on payment type
    amount_paid = Decimal("0")
    insurance_coverage = Decimal("0")
    insurance_limit = Decimal("0")
    insurance_used = Decimal("0")
    patient_topup = Decimal("0")
    payment_status = "unpaid"
    status = "pending_payment"
    visioncare_member_id = None
    
    visit_type = visit_data.get('visit_type', '')
    if payment_type == "insurance":
        # Get insurance limit from request
        insurance_limit = Decimal(str(visit_data.get('insurance_limit', 0) or 0))
        
        if insurance_limit > 0:
            # Calculate how much insurance covers vs patient pays
            if gross_fee <= insurance_limit:
                # Insurance covers full consultation fee
                insurance_used = gross_fee
                insurance_coverage = gross_fee
                amount_paid = gross_fee
                payment_status = "paid"
                status = "waiting"
            else:
                # Insurance covers up to limit, patient pays the rest
                insurance_used = insurance_limit
                insurance_coverage = insurance_limit
                patient_topup = gross_fee - insurance_limit
                # Insurance portion is paid, patient needs to pay topup
                amount_paid = insurance_limit  # Insurance has paid its portion
                payment_status = "partial"  # Partial payment - insurance paid, patient owes balance
                status = "pending_payment"  # Still pending until patient pays topup
        else:
            # No limit specified, insurance covers full amount (legacy behavior)
            insurance_coverage = gross_fee
            amount_paid = gross_fee
            payment_status = "paid"
            status = "waiting"
        
    elif payment_type == "visioncare":
        # Check if patient is a VisionCare member
        member_result = await db.execute(
            select(VisionCareMember).where(
                VisionCareMember.is_active == True,
                func.lower(VisionCareMember.first_name) == patient.first_name.lower(),
                func.lower(VisionCareMember.last_name) == patient.last_name.lower()
            )
        )
        member = member_result.scalar_one_or_none()
        
        if member:
            # Check if membership is valid
            is_valid = True
            if member.valid_until:
                is_valid = member.valid_until > datetime.utcnow()
            
            if is_valid:
                visioncare_member_id = member.member_id
                # VisionCare covers the full consultation fee
                insurance_coverage = gross_fee
                amount_paid = gross_fee
                payment_status = "paid"
                status = "waiting"  # Move directly to waiting queue
            else:
                raise HTTPException(
                    status_code=400, 
                    detail="VisionCare membership has expired. Please renew or select a different payment method."
                )
        else:
            raise HTTPException(
                status_code=400, 
                detail="Patient is not a VisionCare member. Please verify membership or select a different payment method."
            )
    # For cash payment, status remains pending_payment
    
    visit = Visit(
        patient_id=visit_data['patient_id'],
        visit_type=visit_data['visit_type'],
        reason=visit_data.get('reason'),
        notes=visit_data.get('notes'),
        payment_type=payment_type,
        insurance_provider=visit_data.get('insurance_provider'),
        insurance_id=visit_data.get('insurance_id'),
        insurance_number=visit_data.get('insurance_number'),
        insurance_coverage=insurance_coverage,
        insurance_limit=insurance_limit,
        insurance_used=insurance_used,
        patient_topup=patient_topup,
        visioncare_member_id=visioncare_member_id,
        visit_number=generate_visit_number(patient.branch_id, count),
        branch_id=patient.branch_id,
        recorded_by_id=current_user.id,
        consultation_type_id=consultation_type_id,
        consultation_fee=consultation_fee,
        vat_rate=vat_rate,
        vat_amount=vat_amount,
        amount_paid=amount_paid,
        status=status,
        payment_status=payment_status,
        visit_date=datetime.utcnow()
    )
    db.add(visit)
    await db.commit()
    await db.refresh(visit)
    
    # Record revenue for insurance/visioncare payments
    if payment_type in ("insurance", "visioncare") and amount_paid > 0:
        from app.models.revenue import Revenue
        patient_name = f"{patient.first_name} {patient.last_name}"
        
        revenue = Revenue(
            category="consultation",
            description=f"Consultation fee - {patient_name}",
            amount=amount_paid,
            vat_amount=vat_share(amount_paid, vat_amount, gross_fee),
            payment_method=payment_type,
            reference_type="visit",
            reference_id=visit.id,
            patient_id=patient.id,
            branch_id=patient.branch_id,
            recorded_by_id=current_user.id
        )
        db.add(revenue)
        await db.commit()
    
    return visit


@router.put("/visits/{visit_id}", response_model=VisitResponse)
async def update_visit(
    visit_id: int,
    visit_in: VisitUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    for field, value in visit_in.model_dump(exclude_unset=True).items():
        setattr(visit, field, value)
    
    await db.commit()
    await db.refresh(visit)
    return visit


async def apply_visit_payment(db, visit, payment_data: dict, current_user) -> dict:
    """Record a payment against a visit. Anything above the balance is change, not revenue."""
    from app.models.revenue import Revenue
    from app.services.billing import money, visit_total, visit_balance, parse_amount

    balance = visit_balance(visit)
    if balance <= 0:
        raise HTTPException(status_code=400, detail="This visit is already fully paid")
    offered = parse_amount(payment_data.get("amount"), balance)
    applied = min(offered, balance)
    payment_method = str(payment_data.get("payment_method") or "cash")[:50]

    visit.amount_paid = money(visit.amount_paid) + applied
    total = visit_total(visit)
    visit.payment_status = "paid" if visit.amount_paid >= total else "partial"
    if visit.status == "pending_payment":
        visit.status = "waiting"  # into the doctor queue (part-paid too; doctors see a reminder)

    patient_name = f"{visit.patient.first_name} {visit.patient.last_name}" if visit.patient else "Unknown"
    from app.services.vat import vat_share
    db.add(Revenue(
        category="consultation",
        description=f"Consultation fee - {patient_name}",
        amount=applied,
        vat_amount=vat_share(applied, visit.vat_amount, total),
        payment_method=payment_method,
        reference_type="visit",
        reference_id=visit.id,
        patient_id=visit.patient_id,
        branch_id=visit.branch_id,
        recorded_by_id=current_user.id,
    ))
    from app.services.sms.receipts import queue_receipt_sms
    from app.services.sms.service import kick
    await queue_receipt_sms(db, kind="visit", ref_id=visit.id, patient=visit.patient, amount=applied,
                            vat=vat_share(applied, visit.vat_amount, total), balance=max(total - visit.amount_paid, 0),
                            sent_by_id=current_user.id)
    await db.commit()
    kick()
    return {
        "message": "Payment recorded",
        "visit_id": visit.id,
        "applied": float(applied),
        "change": float(offered - applied),
        **visit_money(visit),
        "total": float(total),
        "balance": float(max(total - visit.amount_paid, 0)),
        "payment_status": visit.payment_status,
        "status": visit.status,
    }


async def _load_visit_with_patient(db, visit_id: int):
    from sqlalchemy.orm import joinedload
    result = await db.execute(select(Visit).options(joinedload(Visit.patient)).where(Visit.id == visit_id))
    visit = result.unique().scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    return visit


@router.post("/visits/{visit_id}/pay", dependencies=[Depends(require_permission("payments.create"))])
async def pay_for_visit(
    visit_id: int,
    payment_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    visit = await _load_visit_with_patient(db, visit_id)
    return await apply_visit_payment(db, visit, payment_data, current_user)


@router.get("/visits/pending-payment")
async def get_pending_payment_visits(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import date
    from sqlalchemy.orm import joinedload
    
    today = date.today()
    # Include visits with pending_payment status OR partial payment status (balance remaining)
    # This ensures partial payments still show up until fully paid
    query = select(Visit).options(joinedload(Visit.patient)).where(
        func.date(Visit.visit_date) == today,
        or_(
            Visit.status == "pending_payment",
            Visit.payment_status == "partial"
        )
    ).order_by(Visit.visit_date.asc())
    
    result = await db.execute(query)
    visits = result.unique().scalars().all()
    
    return [
        {
            "id": v.id,
            "visit_number": v.visit_number,
            "patient_id": v.patient_id,
            "patient_name": f"{v.patient.first_name} {v.patient.last_name}" if v.patient else "Unknown",
            "patient_number": v.patient.patient_number if v.patient else "",
            **visit_money(v),
            "payment_status": v.payment_status or "unpaid",
            "visit_date": v.visit_date.isoformat() if v.visit_date else "",
        }
        for v in visits
    ]


@router.get("/visits/{visit_id}")
async def get_visit(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single visit by ID"""
    from sqlalchemy.orm import joinedload
    
    result = await db.execute(
        select(Visit).options(joinedload(Visit.patient)).where(Visit.id == visit_id)
    )
    visit = result.unique().scalar_one_or_none()
    
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    return {
        "id": visit.id,
        "visit_number": visit.visit_number,
        "patient_id": visit.patient_id,
        "patient_name": f"{visit.patient.first_name} {visit.patient.last_name}" if visit.patient else "Unknown",
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else None,
        "visit_type": visit.visit_type,
        "status": visit.status,
        "payment_status": visit.payment_status,
        "payment_type": visit.payment_type,
        **visit_money(visit),
        "insurance_provider": visit.insurance_provider,
        "notes": visit.notes,
    }


@router.post("/visits/{visit_id}/payment", dependencies=[Depends(require_permission("payments.create"))])
async def record_visit_payment(
    visit_id: int,
    payment_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Record a payment for a visit (same as /pay; kept for older screens)"""
    visit = await _load_visit_with_patient(db, visit_id)
    return await apply_visit_payment(db, visit, payment_data, current_user)


@router.get("/visits/{visit_id}/insurance-balance")
async def get_visit_insurance_balance(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get insurance balance details for a visit"""
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    insurance_limit = float(visit.insurance_limit or 0)
    insurance_used = float(visit.insurance_used or 0)
    patient_topup = float(visit.patient_topup or 0)
    insurance_remaining = max(0, insurance_limit - insurance_used)
    
    return {
        "visit_id": visit_id,
        "payment_type": visit.payment_type,
        "insurance_provider": visit.insurance_provider,
        "insurance_limit": insurance_limit,
        "insurance_used": insurance_used,
        "insurance_remaining": insurance_remaining,
        "patient_topup": patient_topup,
        **visit_money(visit),
        "is_insurance": visit.payment_type == "insurance",
    }


@router.post("/check-duplicates")
async def check_duplicate_patients(
    patient_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    first_name = patient_data.get("first_name", "")
    last_name = patient_data.get("last_name", "")
    phone = patient_data.get("phone", "")
    
    candidates = []
    
    if first_name and last_name:
        query = select(Patient).where(
            or_(
                (func.lower(Patient.first_name) == first_name.lower()) & 
                (func.lower(Patient.last_name) == last_name.lower()),
                Patient.phone == phone if phone else False
            )
        ).limit(10)
        
        result = await db.execute(query)
        patients = result.scalars().all()
        
        for p in patients:
            score = 0
            if p.first_name.lower() == first_name.lower():
                score += 40
            if p.last_name.lower() == last_name.lower():
                score += 40
            if phone and p.phone == phone:
                score += 20
            
            if score > 0:
                candidates.append({
                    "id": p.id,
                    "patient_number": p.patient_number,
                    "first_name": p.first_name,
                    "last_name": p.last_name,
                    "phone": p.phone,
                    "date_of_birth": str(p.date_of_birth) if p.date_of_birth else None,
                    "match_score": score,
                })
    
    return sorted(candidates, key=lambda x: x["match_score"], reverse=True)


# Public routes (no login) live on their own router so the staff permission gate doesn't apply
public_router = APIRouter()


@public_router.post("/self-register", dependencies=[Depends(rate_limit("self-register", 10, 600))])
async def self_register_patient(
    patient_data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Public endpoint for patients to self-register. Creates a pending registration."""
    from app.models.patient import PendingRegistration
    from datetime import datetime

    # Only plain text fields, with sane lengths
    patient_data = {
        k: (str(v).strip()[:255] if v is not None else "")
        for k, v in patient_data.items()
        if isinstance(v, (str, int, float)) or v is None
    }
    if not patient_data.get("first_name") or not patient_data.get("last_name"):
        raise HTTPException(status_code=400, detail="First and last name are required")
    
    # Check for duplicate phone number globally
    phone = patient_data.get("phone", "").strip()
    if phone:
        phone_check = await db.execute(
            select(Patient.id).where(Patient.phone == phone).limit(1)
        )
        existing_by_phone = phone_check.first()
        if existing_by_phone:
            raise HTTPException(
                status_code=400, 
                detail=f"A patient with this phone number already exists in our system. Please visit the front desk for assistance."
            )
    
    # Check for duplicate ghana_card globally
    ghana_card = patient_data.get("ghana_card", "").strip()
    if ghana_card:
        ghana_card_check = await db.execute(
            select(Patient).where(Patient.ghana_card == ghana_card).limit(1)
        )
        existing_by_ghana_card = ghana_card_check.scalars().first()
        if existing_by_ghana_card:
            raise HTTPException(
                status_code=400, 
                detail=f"A patient with this Ghana Card number already exists in our system. Please visit the front desk for assistance."
            )
    
    # Convert date_of_birth string to date object
    dob = patient_data.get("date_of_birth")
    if dob and isinstance(dob, str) and dob.strip():
        try:
            dob = datetime.strptime(dob, '%Y-%m-%d').date()
        except ValueError:
            dob = None
    else:
        dob = None
    
    pending = PendingRegistration(
        first_name=patient_data.get("first_name", ""),
        last_name=patient_data.get("last_name", ""),
        other_names=patient_data.get("other_names", ""),
        date_of_birth=dob,
        sex=patient_data.get("sex", ""),
        marital_status=patient_data.get("marital_status", ""),
        phone=patient_data.get("phone", ""),
        email=patient_data.get("email", ""),
        address=patient_data.get("address", ""),
        nationality=patient_data.get("nationality", "Ghanaian"),
        occupation=patient_data.get("occupation", ""),
        emergency_contact_name=patient_data.get("emergency_contact_name", ""),
        emergency_contact_phone=patient_data.get("emergency_contact_phone", ""),
        ghana_card=patient_data.get("ghana_card", ""),
        status="pending"
    )
    db.add(pending)
    await db.commit()
    await db.refresh(pending)
    
    return {"message": "Registration submitted successfully", "id": pending.id}


@router.get("/pending-registrations/{registration_id}")
async def get_pending_registration(
    registration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single pending registration details."""
    from app.models.patient import PendingRegistration
    
    result = await db.execute(
        select(PendingRegistration).where(PendingRegistration.id == registration_id)
    )
    r = result.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Pending registration not found")
    
    return {
        "id": r.id,
        "first_name": r.first_name,
        "last_name": r.last_name,
        "other_names": r.other_names,
        "phone": r.phone,
        "email": r.email,
        "date_of_birth": str(r.date_of_birth) if r.date_of_birth else None,
        "sex": r.sex,
        "marital_status": r.marital_status,
        "address": r.address,
        "nationality": r.nationality,
        "occupation": r.occupation,
        "ghana_card": r.ghana_card,
        "emergency_contact_name": r.emergency_contact_name,
        "emergency_contact_phone": r.emergency_contact_phone,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else "",
    }


@router.put("/pending-registrations/{registration_id}")
async def update_pending_registration(
    registration_id: int,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a pending registration before approval."""
    from app.models.patient import PendingRegistration
    from datetime import datetime
    
    result = await db.execute(
        select(PendingRegistration).where(PendingRegistration.id == registration_id)
    )
    pending = result.scalar_one_or_none()
    if not pending:
        raise HTTPException(status_code=404, detail="Pending registration not found")
    
    # Update fields
    for field in ['first_name', 'last_name', 'other_names', 'phone', 'email', 
                  'sex', 'marital_status', 'address', 'nationality', 'occupation',
                  'ghana_card', 'emergency_contact_name', 'emergency_contact_phone']:
        if field in data:
            setattr(pending, field, data[field] if data[field] else None)
    
    # Handle date_of_birth separately
    if 'date_of_birth' in data:
        dob = data['date_of_birth']
        if dob and isinstance(dob, str) and dob.strip():
            try:
                pending.date_of_birth = datetime.strptime(dob, '%Y-%m-%d').date()
            except ValueError:
                pending.date_of_birth = None
        else:
            pending.date_of_birth = None
    
    await db.commit()
    return {"message": "Registration updated successfully"}


@router.post("/pending-registrations/{registration_id}/approve")
async def approve_pending_registration(
    registration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Approve a pending registration and create the patient record."""
    from app.models.patient import PendingRegistration
    
    result = await db.execute(
        select(PendingRegistration).where(PendingRegistration.id == registration_id)
    )
    pending = result.scalar_one_or_none()
    if not pending:
        raise HTTPException(status_code=404, detail="Pending registration not found")
    
    branch_id = current_user.branch_id or 1
    count_result = await db.execute(
        select(func.count(Patient.id)).where(Patient.branch_id == branch_id)
    )
    count = count_result.scalar() + 1
    
    patient = Patient(
        first_name=pending.first_name,
        last_name=pending.last_name,
        other_names=pending.other_names,
        date_of_birth=pending.date_of_birth,
        sex=pending.sex,
        marital_status=pending.marital_status,
        phone=pending.phone,
        email=(pending.email or "").strip() or None,
        address=pending.address,
        occupation=pending.occupation,
        emergency_contact_name=pending.emergency_contact_name,
        emergency_contact_phone=pending.emergency_contact_phone,
        nationality=pending.nationality,
        ghana_card=pending.ghana_card or None,
        branch_id=branch_id,
        patient_number=await next_patient_number(db, branch_id, count)
    )
    db.add(patient)
    
    pending.status = "approved"
    
    await db.commit()
    await db.refresh(patient)
    
    return {"message": "Patient approved and created", "patient_id": patient.id}


@router.delete("/pending-registrations/{registration_id}")
async def reject_pending_registration(
    registration_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reject/delete a pending registration."""
    from app.models.patient import PendingRegistration
    
    result = await db.execute(
        select(PendingRegistration).where(PendingRegistration.id == registration_id)
    )
    pending = result.scalar_one_or_none()
    if not pending:
        raise HTTPException(status_code=404, detail="Pending registration not found")
    
    pending.status = "rejected"
    await db.commit()
    
    return {"message": "Registration rejected"}
