from typing import List, Optional
from datetime import datetime, date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from pydantic import BaseModel

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.utils.pdf_generator import generate_spectacles_prescription_pdf
from app.models.patient import Visit, Patient
from app.models.clinical import ConsultationType, Consultation, ClinicalRecord, Prescription, PrescriptionItem, ClinicalRecordHistory
from app.models.technician_referral import TechnicianScan
from app.schemas.clinical import (
    ConsultationTypeCreate, ConsultationTypeResponse,
    ConsultationCreate, ConsultationResponse,
    ClinicalRecordCreate, ClinicalRecordUpdate, ClinicalRecordResponse,
    PrescriptionCreate, PrescriptionResponse
)

router = APIRouter()


@router.get("/types", response_model=List[ConsultationTypeResponse])
async def get_consultation_types(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(ConsultationType)
    if not include_inactive:
        query = query.where(ConsultationType.is_active == True)
    result = await db.execute(query.order_by(ConsultationType.name))
    return result.scalars().all()


@router.post("/types", response_model=ConsultationTypeResponse)
async def create_consultation_type(
    type_in: ConsultationTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    consultation_type = ConsultationType(**type_in.model_dump())
    db.add(consultation_type)
    await db.commit()
    await db.refresh(consultation_type)
    return consultation_type


@router.put("/types/{type_id}", response_model=ConsultationTypeResponse)
async def update_consultation_type(
    type_id: int,
    type_in: ConsultationTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ConsultationType).where(ConsultationType.id == type_id))
    consultation_type = result.scalar_one_or_none()
    if not consultation_type:
        raise HTTPException(status_code=404, detail="Consultation type not found")
    
    for field, value in type_in.model_dump(exclude_unset=True).items():
        setattr(consultation_type, field, value)
    
    await db.commit()
    await db.refresh(consultation_type)
    return consultation_type


@router.patch("/types/{type_id}/deactivate")
async def deactivate_consultation_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ConsultationType).where(ConsultationType.id == type_id))
    consultation_type = result.scalar_one_or_none()
    if not consultation_type:
        raise HTTPException(status_code=404, detail="Consultation type not found")
    
    consultation_type.is_active = False
    await db.commit()
    return {"message": "Consultation type deactivated"}


@router.patch("/types/{type_id}/activate")
async def activate_consultation_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ConsultationType).where(ConsultationType.id == type_id))
    consultation_type = result.scalar_one_or_none()
    if not consultation_type:
        raise HTTPException(status_code=404, detail="Consultation type not found")
    
    consultation_type.is_active = True
    await db.commit()
    return {"message": "Consultation type activated"}


@router.delete("/types/{type_id}")
async def delete_consultation_type(
    type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ConsultationType).where(ConsultationType.id == type_id))
    consultation_type = result.scalar_one_or_none()
    if not consultation_type:
        raise HTTPException(status_code=404, detail="Consultation type not found")
    
    await db.delete(consultation_type)
    await db.commit()
    return {"message": "Consultation type permanently deleted"}


@router.get("/", response_model=List[ConsultationResponse])
async def get_consultations(
    visit_id: int = None,
    doctor_id: int = None,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Consultation)
    if visit_id:
        query = query.where(Consultation.visit_id == visit_id)
    if doctor_id:
        query = query.where(Consultation.doctor_id == doctor_id)
    if status:
        query = query.where(Consultation.status == status)
    
    result = await db.execute(query.order_by(Consultation.created_at.desc()))
    return result.scalars().all()


@router.post("/", response_model=ConsultationResponse)
async def create_consultation(
    consultation_in: ConsultationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    if consultation_in.fee is None:
        type_result = await db.execute(
            select(ConsultationType).where(ConsultationType.id == consultation_in.consultation_type_id)
        )
        consultation_type = type_result.scalar_one_or_none()
        fee = float(consultation_type.base_fee) if consultation_type else 0
    else:
        fee = consultation_in.fee
    
    consultation = Consultation(
        visit_id=consultation_in.visit_id,
        consultation_type_id=consultation_in.consultation_type_id,
        doctor_id=consultation_in.doctor_id,
        fee=fee
    )
    db.add(consultation)
    await db.commit()
    await db.refresh(consultation)
    return consultation


@router.put("/{consultation_id}/start")
async def start_consultation(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Consultation).where(Consultation.id == consultation_id))
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    consultation.status = "in_progress"
    consultation.started_at = datetime.utcnow()
    await db.commit()
    return {"message": "Consultation started"}


@router.put("/{consultation_id}/complete")
async def complete_consultation(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Consultation).where(Consultation.id == consultation_id))
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="Consultation not found")
    
    consultation.status = "completed"
    consultation.completed_at = datetime.utcnow()
    await db.commit()
    return {"message": "Consultation completed"}


@router.get("/patients/{patient_id}/records")
async def get_patient_clinical_records(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all clinical records for a patient"""
    result = await db.execute(
        select(ClinicalRecord)
        .where(ClinicalRecord.patient_id == patient_id)
        .order_by(ClinicalRecord.created_at.desc())
    )
    records = result.scalars().all()
    return [
        {
            "id": r.id,
            "visit_id": r.visit_id,
            "chief_complaint": r.chief_complaint,
            "history_of_present_illness": r.history_of_present_illness,
            "past_ocular_history": r.past_ocular_history,
            "past_medical_history": r.past_medical_history,
            "family_history": r.family_history,
            "visual_acuity_od": r.visual_acuity_od,
            "visual_acuity_os": r.visual_acuity_os,
            "iop_od": r.iop_od,
            "iop_os": r.iop_os,
            "anterior_segment_od": r.anterior_segment_od,
            "anterior_segment_os": r.anterior_segment_os,
            "posterior_segment_od": r.posterior_segment_od,
            "posterior_segment_os": r.posterior_segment_os,
            "diagnosis": r.diagnosis,
            "management_plan": r.management_plan,
            "follow_up_date": r.follow_up_date.isoformat() if r.follow_up_date else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in records
    ]


@router.get("/visits/{visit_id}/detail")
async def get_visit_detail(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed visit information including clinical record and prescriptions"""
    result = await db.execute(
        select(Visit)
        .options(joinedload(Visit.patient))
        .where(Visit.id == visit_id)
    )
    visit = result.unique().scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Get clinical record
    record_result = await db.execute(
        select(ClinicalRecord).where(ClinicalRecord.visit_id == visit_id)
    )
    clinical_record = record_result.scalar_one_or_none()
    
    # Get prescriptions
    rx_result = await db.execute(
        select(Prescription).where(Prescription.visit_id == visit_id)
    )
    prescriptions = rx_result.scalars().all()
    
    return {
        "id": visit.id,
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else None,
        "visit_type": visit.visit_type.value if visit.visit_type else None,
        "reason": visit.reason,
        "status": visit.status,
        "payment_status": visit.payment_status,
        "consultation_fee": float(visit.consultation_fee) if visit.consultation_fee else 0,
        "amount_paid": float(visit.amount_paid) if visit.amount_paid else 0,
        "clinical_record": {
            "id": clinical_record.id,
            "chief_complaint": clinical_record.chief_complaint,
            "history_of_present_illness": clinical_record.history_of_present_illness,
            "diagnosis": clinical_record.diagnosis,
            "management_plan": clinical_record.management_plan,
            "visual_acuity_od": clinical_record.visual_acuity_od,
            "visual_acuity_os": clinical_record.visual_acuity_os,
            "follow_up_date": clinical_record.follow_up_date.isoformat() if clinical_record.follow_up_date else None,
        } if clinical_record else None,
        "prescriptions": [
            {
                "id": rx.id,
                "status": rx.status,
                "total_amount": float(rx.total_amount) if rx.total_amount else 0,
            }
            for rx in prescriptions
        ]
    }


@router.get("/{consultation_id}/record", response_model=ClinicalRecordResponse)
async def get_clinical_record(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(ClinicalRecord).where(ClinicalRecord.consultation_id == consultation_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    return record


@router.post("/{consultation_id}/record", response_model=ClinicalRecordResponse)
async def create_clinical_record(
    consultation_id: int,
    record_in: ClinicalRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    existing = await db.execute(
        select(ClinicalRecord).where(ClinicalRecord.consultation_id == consultation_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Clinical record already exists")
    
    record = ClinicalRecord(**record_in.model_dump())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


@router.put("/{consultation_id}/record", response_model=ClinicalRecordResponse)
async def update_clinical_record(
    consultation_id: int,
    record_in: ClinicalRecordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(ClinicalRecord).where(ClinicalRecord.consultation_id == consultation_id)
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Clinical record not found")
    
    for field, value in record_in.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    
    await db.commit()
    await db.refresh(record)
    return record


@router.get("/{consultation_id}/prescriptions", response_model=List[PrescriptionResponse])
async def get_prescriptions(
    consultation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Prescription).where(Prescription.consultation_id == consultation_id)
    )
    return result.scalars().all()


@router.post("/{consultation_id}/prescriptions", response_model=PrescriptionResponse)
async def create_prescription(
    consultation_id: int,
    prescription_in: PrescriptionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    prescription_data = prescription_in.model_dump(exclude={"items"})
    prescription = Prescription(**prescription_data)
    db.add(prescription)
    await db.flush()
    
    for item_data in prescription_in.items or []:
        item = PrescriptionItem(prescription_id=prescription.id, **item_data.model_dump())
        db.add(item)
    
    await db.commit()
    await db.refresh(prescription)
    return prescription


@router.get("/queue")
async def get_doctor_queue(
    status: str = Query("waiting"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    today = date.today()
    query = select(Visit).options(joinedload(Visit.patient), joinedload(Visit.consultation_type)).where(
        func.date(Visit.visit_date) == today
    )
    
    if status == "all":
        # Show all statuses except pending_payment
        query = query.where(Visit.status.in_(["waiting", "in_consultation", "completed"]))
    elif status == "active":
        # Show both waiting and in_consultation
        query = query.where(Visit.status.in_(["waiting", "in_consultation"]))
    else:
        query = query.where(Visit.status == status)
    
    query = query.order_by(Visit.visit_date.asc())
    result = await db.execute(query)
    visits = result.unique().scalars().all()
    
    queue_items = []
    now = datetime.utcnow()
    for visit in visits:
        # Calculate wait time - use visit_date as the start time
        wait_minutes = 0
        if visit.visit_date and visit.status in ["waiting", "in_consultation"]:
            time_diff = now - visit.visit_date
            wait_minutes = max(0, int(time_diff.total_seconds() / 60))
        consultation_fee = float(visit.consultation_fee) if visit.consultation_fee else 0
        amount_paid = float(visit.amount_paid) if visit.amount_paid else 0
        balance = max(0, consultation_fee - amount_paid)
        queue_items.append({
            "id": visit.id,
            "patient_id": visit.patient_id,
            "patient_name": f"{visit.patient.first_name} {visit.patient.last_name}" if visit.patient else "Unknown",
            "patient_number": visit.patient.patient_number if visit.patient else "",
            "visit_type": visit.visit_type.value if hasattr(visit.visit_type, 'value') else str(visit.visit_type),
            "reason": visit.reason or "",
            "status": visit.status,
            "payment_status": getattr(visit, 'payment_status', 'unknown') or "unknown",
            "payment_type": getattr(visit, 'payment_type', 'cash') or "cash",
            "consultation_fee": consultation_fee,
            "amount_paid": amount_paid,
            "balance": balance,
            "consultation_type": visit.consultation_type.name if visit.consultation_type else "",
            "wait_time_minutes": max(0, wait_minutes),
            "visit_date": visit.visit_date.isoformat() if visit.visit_date else "",
        })
    
    return queue_items


@router.get("/visits/{visit_id}")
async def get_visit_details(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Visit).options(joinedload(Visit.patient)).where(Visit.id == visit_id)
    )
    visit = result.unique().scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    return {
        "id": visit.id,
        "patient_id": visit.patient_id,
        "visit_type": visit.visit_type.value if hasattr(visit.visit_type, 'value') else str(visit.visit_type),
        "reason": visit.reason,
        "notes": visit.notes,
        "status": visit.status,
        "visit_date": visit.visit_date.isoformat() if visit.visit_date else "",
        "payment_status": visit.payment_status,
        "consultation_fee": float(visit.consultation_fee) if visit.consultation_fee else 0,
        "amount_paid": float(visit.amount_paid) if visit.amount_paid else 0,
    }


@router.patch("/visits/{visit_id}/status")
async def update_visit_status(
    visit_id: int,
    status_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    visit.status = status_data.get("status", visit.status)
    await db.commit()
    return {"message": "Status updated"}


@router.post("/visits/{visit_id}/record")
async def save_clinical_record_for_visit(
    visit_id: int,
    record_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime, date
    
    result = await db.execute(select(Visit).where(Visit.id == visit_id))
    visit = result.scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    existing = await db.execute(
        select(ClinicalRecord).where(ClinicalRecord.visit_id == visit_id)
    )
    record = existing.scalar_one_or_none()
    
    # Process the record data to handle date fields
    # Exclude system fields that should not be set from frontend
    excluded_fields = {'id', 'created_at', 'updated_at', 'visit_id', 'patient_id', 'recorded_by_id', 'consultation_id'}
    
    # Date fields that need special handling
    date_fields = {'follow_up_date'}
    
    processed_data = {}
    for key, value in record_data.items():
        if key in excluded_fields:
            continue
        if hasattr(ClinicalRecord, key):
            if key in date_fields:
                # Convert string date to datetime object, handle empty strings
                if value and isinstance(value, str) and value.strip():
                    try:
                        processed_data[key] = datetime.strptime(value, '%Y-%m-%d').date()
                    except ValueError:
                        processed_data[key] = None
                else:
                    processed_data[key] = None
            else:
                # For non-date fields, convert empty strings to None
                if value == '':
                    processed_data[key] = None
                else:
                    processed_data[key] = value
    
    if record:
        # Track changes for existing record
        changes = []
        for key, value in processed_data.items():
            if hasattr(record, key):
                old_value = getattr(record, key)
                # Normalize None and empty string for comparison
                old_normalized = old_value if old_value not in (None, '', 'None') else None
                new_normalized = value if value not in (None, '', 'None') else None
                
                # Check if there's an actual change
                if str(old_normalized or '') != str(new_normalized or ''):
                    # Record the change
                    history_entry = ClinicalRecordHistory(
                        clinical_record_id=record.id,
                        modified_by_id=current_user.id,
                        action='update',
                        field_name=key,
                        old_value=str(old_value) if old_value else None,
                        new_value=str(value) if value else None,
                        change_summary=f"Updated {key.replace('_', ' ')}"
                    )
                    db.add(history_entry)
                    changes.append(key)
                setattr(record, key, value)
    else:
        record = ClinicalRecord(
            visit_id=visit_id,
            patient_id=visit.patient_id,
            recorded_by_id=current_user.id,
            **processed_data
        )
        db.add(record)
        await db.flush()
        
        # Record creation
        history_entry = ClinicalRecordHistory(
            clinical_record_id=record.id,
            modified_by_id=current_user.id,
            action='create',
            field_name=None,
            old_value=None,
            new_value=None,
            change_summary="Created clinical record"
        )
        db.add(history_entry)
    
    await db.commit()
    return {"message": "Clinical record saved"}


@router.get("/records/{record_id}/history")
async def get_clinical_record_history(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get the change history for a clinical record (git-like audit trail)"""
    result = await db.execute(
        select(ClinicalRecordHistory)
        .options(joinedload(ClinicalRecordHistory.modified_by))
        .where(ClinicalRecordHistory.clinical_record_id == record_id)
        .order_by(ClinicalRecordHistory.created_at.desc())
    )
    history = result.unique().scalars().all()
    
    return [
        {
            "id": h.id,
            "action": h.action,
            "field_name": h.field_name,
            "old_value": h.old_value,
            "new_value": h.new_value,
            "change_summary": h.change_summary,
            "modified_by": {
                "id": h.modified_by.id,
                "full_name": f"{h.modified_by.first_name} {h.modified_by.last_name}",
            } if h.modified_by else None,
            "created_at": h.created_at.isoformat() if h.created_at else None,
        }
        for h in history
    ]


@router.get("/visits/{visit_id}/prescriptions")
async def get_visit_prescriptions(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all prescriptions for a visit with their items"""
    result = await db.execute(
        select(Prescription)
        .options(joinedload(Prescription.items))
        .where(Prescription.visit_id == visit_id)
        .order_by(Prescription.created_at.desc())
    )
    prescriptions = result.unique().scalars().all()
    
    return [
        {
            "id": p.id,
            "prescription_type": p.prescription_type,
            "total_amount": float(p.total_amount) if p.total_amount else 0,
            "status": p.status,
            "is_dispensed": p.is_dispensed,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            # Optical prescription fields
            "sphere_od": p.sphere_od,
            "cylinder_od": p.cylinder_od,
            "axis_od": p.axis_od,
            "va_od": getattr(p, 'va_od', None),
            "sphere_os": p.sphere_os,
            "cylinder_os": p.cylinder_os,
            "axis_os": p.axis_os,
            "va_os": getattr(p, 'va_os', None),
            "add_power": p.add_power,
            "pd": p.pd,
            "segment_height": getattr(p, 'segment_height', None),
            "lens_type": p.lens_type,
            "lens_material": p.lens_material,
            "lens_coating": p.lens_coating,
            "frame_code": getattr(p, 'frame_code', None),
            "frame_size": getattr(p, 'frame_size', None),
            "dispensed_by_name": getattr(p, 'dispensed_by_name', None),
            "delivery_date": p.delivery_date.isoformat() if getattr(p, 'delivery_date', None) else None,
            "remarks": getattr(p, 'remarks', None),
            "items": [
                {
                    "id": item.id,
                    "item_type": item.item_type,
                    "name": item.name,
                    "description": item.description,
                    "dosage": item.dosage,
                    "duration": item.duration,
                    "quantity": item.quantity,
                    "unit_price": float(item.unit_price) if item.unit_price else 0,
                    "is_external": getattr(item, 'is_external', False),
                    "was_out_of_stock": getattr(item, 'was_out_of_stock', False),
                }
                for item in p.items
            ]
        }
        for p in prescriptions
    ]


@router.post("/visits/{visit_id}/prescription")
async def create_prescription_for_visit(
    visit_id: int,
    prescription_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from app.models.clinical import OutOfStockRequest
    
    result = await db.execute(
        select(Visit).options(joinedload(Visit.patient)).where(Visit.id == visit_id)
    )
    visit = result.unique().scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    items = prescription_data.get("items", [])
    total = sum(item.get("quantity", 1) * item.get("unit_price", 0) for item in items)
    
    prescription = Prescription(
        visit_id=visit_id,
        patient_id=visit.patient_id,
        prescribed_by_id=current_user.id,
        total_amount=total,
        status="pending"
    )
    db.add(prescription)
    await db.flush()
    
    for item in items:
        is_out_of_stock = item.get("stock_quantity", None) == 0 and not item.get("is_external", False)
        
        prescription_item = PrescriptionItem(
            prescription_id=prescription.id,
            product_id=item.get("product_id"),
            item_type=item.get("item_type", "other"),
            name=item.get("name", ""),
            description=item.get("description", ""),
            dosage=item.get("dosage"),
            duration=item.get("duration"),
            quantity=item.get("quantity", 1),
            unit_price=item.get("unit_price", 0),
            is_external=item.get("is_external", False),
            was_out_of_stock=is_out_of_stock
        )
        db.add(prescription_item)
        
        # Track out-of-stock requests for analytics
        if is_out_of_stock and item.get("product_id"):
            out_of_stock_request = OutOfStockRequest(
                product_id=item.get("product_id"),
                product_name=item.get("name", ""),
                prescription_id=prescription.id,
                patient_id=visit.patient_id,
                prescribed_by_id=current_user.id,
                quantity_requested=item.get("quantity", 1)
            )
            db.add(out_of_stock_request)
    
    await db.commit()
    return {"message": "Prescription created", "prescription_id": prescription.id}


@router.post("/visits/{visit_id}/optical-prescription")
async def create_optical_prescription(
    visit_id: int,
    prescription_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create an optical/spectacles prescription with full form data"""
    # Get visit
    result = await db.execute(
        select(Visit).options(joinedload(Visit.patient)).where(Visit.id == visit_id)
    )
    visit = result.unique().scalar_one_or_none()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    # Create prescription with optical data
    prescription = Prescription(
        visit_id=visit_id,
        patient_id=visit.patient_id,
        prescribed_by_id=current_user.id,
        prescription_type="optical",
        status="pending",
        # Prescription values
        sphere_od=prescription_data.get("sphere_od"),
        cylinder_od=prescription_data.get("cylinder_od"),
        axis_od=prescription_data.get("axis_od"),
        va_od=prescription_data.get("va_od"),
        sphere_os=prescription_data.get("sphere_os"),
        cylinder_os=prescription_data.get("cylinder_os"),
        axis_os=prescription_data.get("axis_os"),
        va_os=prescription_data.get("va_os"),
        add_power=prescription_data.get("add_power"),
        pd=prescription_data.get("pd"),
        segment_height=prescription_data.get("segment_height"),
        # Lens and frame info
        lens_type=prescription_data.get("lens_type"),
        # Handle arrays for lens_material and lens_coating - join with comma
        lens_material=", ".join(prescription_data.get("lens_material", [])) if isinstance(prescription_data.get("lens_material"), list) else prescription_data.get("lens_material"),
        lens_coating=", ".join(prescription_data.get("lens_coating", [])) if isinstance(prescription_data.get("lens_coating"), list) else prescription_data.get("lens_coating"),
        frame_code=prescription_data.get("frame_code"),
        frame_size=prescription_data.get("frame_size"),
        dispensed_by_name=prescription_data.get("dispensed_by_name"),
        remarks=prescription_data.get("remarks"),
    )
    
    # Handle delivery date
    delivery_date_str = prescription_data.get("delivery_date")
    if delivery_date_str:
        try:
            prescription.delivery_date = datetime.strptime(delivery_date_str, "%Y-%m-%d")
        except ValueError:
            pass
    
    db.add(prescription)
    await db.commit()
    await db.refresh(prescription)
    
    return {"message": "Optical prescription saved", "prescription_id": prescription.id}


@router.get("/patients/{patient_id}/history")
async def get_patient_clinical_history(
    patient_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(ClinicalRecord).where(ClinicalRecord.patient_id == patient_id).order_by(ClinicalRecord.created_at.desc())
    )
    records = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "visit_date": r.created_at.isoformat() if r.created_at else "",
            "diagnosis": r.diagnosis,
            "management_plan": r.management_plan,
            "consultation_type": "",
        }
        for r in records
    ]


@router.get("/prescriptions/pending")
async def get_pending_prescriptions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Prescription)
        .options(joinedload(Prescription.patient), joinedload(Prescription.items))
        .where(Prescription.status == "pending")
        .order_by(Prescription.created_at.desc())
    )
    prescriptions = result.unique().scalars().all()
    
    return [
        {
            "id": p.id,
            "patient_name": f"{p.patient.first_name} {p.patient.last_name}" if p.patient else "Unknown",
            "patient_number": p.patient.patient_number if p.patient else "",
            "items": [
                {"name": item.name, "quantity": item.quantity, "unit_price": float(item.unit_price)}
                for item in p.items
            ],
            "total_amount": float(p.total_amount) if p.total_amount else 0,
            "created_at": p.created_at.isoformat() if p.created_at else "",
            "status": p.status,
        }
        for p in prescriptions
    ]


@router.post("/prescriptions/{prescription_id}/payment")
async def process_prescription_payment(
    prescription_id: int,
    payment_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from decimal import Decimal
    
    result = await db.execute(select(Prescription).where(Prescription.id == prescription_id))
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    prescription.status = "paid"
    prescription.payment_method = payment_data.get("payment_method")
    prescription.paid_at = datetime.utcnow()
    
    # Track insurance usage if this is an insurance visit
    if prescription.consultation_id:
        consultation_result = await db.execute(
            select(Consultation).where(Consultation.id == prescription.consultation_id)
        )
        consultation = consultation_result.scalar_one_or_none()
        if consultation and consultation.visit_id:
            visit_result = await db.execute(
                select(Visit).where(Visit.id == consultation.visit_id)
            )
            visit = visit_result.scalar_one_or_none()
            if visit and visit.payment_type == "insurance" and visit.insurance_limit:
                # Calculate prescription total
                prescription_total = Decimal("0")
                items_result = await db.execute(
                    select(PrescriptionItem).where(PrescriptionItem.prescription_id == prescription_id)
                )
                items = items_result.scalars().all()
                for item in items:
                    prescription_total += Decimal(str(item.unit_price or 0)) * Decimal(str(item.quantity or 1))
                
                # Update insurance used
                current_used = Decimal(str(visit.insurance_used or 0))
                new_used = current_used + prescription_total
                insurance_limit = Decimal(str(visit.insurance_limit))
                
                if new_used > insurance_limit:
                    # Patient needs to pay the excess
                    visit.patient_topup = new_used - insurance_limit
                    visit.insurance_used = insurance_limit
                else:
                    visit.insurance_used = new_used
    
    await db.commit()
    return {"message": "Payment processed", "receipt_id": prescription.id}


@router.get("/out-of-stock-analytics")
async def get_out_of_stock_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get analytics for out-of-stock prescription requests - helps identify products to reorder"""
    from app.models.clinical import OutOfStockRequest
    from datetime import timedelta
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Get aggregated out-of-stock requests grouped by product
    result = await db.execute(
        select(
            OutOfStockRequest.product_id,
            OutOfStockRequest.product_name,
            func.count(OutOfStockRequest.id).label('request_count'),
            func.sum(OutOfStockRequest.quantity_requested).label('total_quantity')
        )
        .where(OutOfStockRequest.created_at >= cutoff_date)
        .group_by(OutOfStockRequest.product_id, OutOfStockRequest.product_name)
        .order_by(func.count(OutOfStockRequest.id).desc())
    )
    
    analytics = result.all()
    
    return {
        "period_days": days,
        "items": [
            {
                "product_id": row.product_id,
                "product_name": row.product_name,
                "request_count": row.request_count,
                "total_quantity_requested": row.total_quantity or 0,
            }
            for row in analytics
        ]
    }


@router.get("/consultation-types")
async def list_consultation_types(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(ConsultationType).where(ConsultationType.is_active == True))
    types = result.scalars().all()
    return [
        {"id": t.id, "name": t.name, "base_fee": float(t.base_fee) if t.base_fee else 0}
        for t in types
    ]


# ============ DOCTOR SCAN REQUEST ============

class ScanRequestCreate(BaseModel):
    patient_id: int
    visit_id: int
    consultation_id: Optional[int] = None
    scan_type: str
    notes: Optional[str] = None


async def generate_scan_number(db: AsyncSession) -> str:
    """Generate unique scan number"""
    today = datetime.now().strftime("%Y%m%d")
    result = await db.execute(
        select(func.count(TechnicianScan.id))
        .where(TechnicianScan.scan_number.like(f"SCN-{today}%"))
    )
    count = result.scalar() or 0
    return f"SCN-{today}-{str(count + 1).zfill(4)}"


@router.post("/request-scan")
async def request_scan(
    data: ScanRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Doctor requests a scan for a patient during consultation"""
    # Validate scan type
    valid_types = ["oct", "vft", "fundus", "pachymeter"]
    if data.scan_type.lower() not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid scan type. Must be one of: {valid_types}")
    
    # Verify patient exists
    patient_result = await db.execute(select(Patient).where(Patient.id == data.patient_id))
    if not patient_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Verify visit exists
    visit_result = await db.execute(select(Visit).where(Visit.id == data.visit_id))
    if not visit_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Visit not found")
    
    scan_number = await generate_scan_number(db)
    
    # Create scan request
    scan = TechnicianScan(
        scan_number=scan_number,
        scan_type=data.scan_type.lower(),
        patient_id=data.patient_id,
        visit_id=data.visit_id,
        consultation_id=data.consultation_id,
        requested_by_id=current_user.id,
        requested_at=datetime.utcnow(),
        branch_id=current_user.branch_id,
        notes=data.notes,
        status="pending"
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    
    return {
        "id": scan.id,
        "scan_number": scan.scan_number,
        "scan_type": scan.scan_type,
        "status": scan.status,
        "message": "Scan requested successfully. Technician will be notified."
    }


@router.get("/prescriptions/{prescription_id}/download-pdf")
async def download_prescription_pdf(
    prescription_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Download spectacles prescription as PDF"""
    # Get prescription with related data
    result = await db.execute(
        select(Prescription)
        .options(
            joinedload(Prescription.patient),
            joinedload(Prescription.consultation).joinedload(Consultation.doctor),
            joinedload(Prescription.consultation).joinedload(Consultation.visit)
        )
        .where(Prescription.id == prescription_id)
    )
    prescription = result.unique().scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    # Get patient info
    patient = prescription.patient
    consultation = prescription.consultation
    visit = consultation.visit if consultation else None
    doctor = consultation.doctor if consultation else None
    
    # Calculate patient age
    patient_age = ""
    if patient and patient.date_of_birth:
        today = date.today()
        age = today.year - patient.date_of_birth.year - ((today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day))
        patient_age = str(age)
    
    # Determine patient type based on visit count
    patient_type = "New"
    if patient:
        visit_count_result = await db.execute(
            select(func.count(Visit.id)).where(Visit.patient_id == patient.id)
        )
        visit_count = visit_count_result.scalar() or 0
        if visit_count > 1:
            patient_type = "Returning"
    
    # Get VisionCare member status from visit
    visioncare_member = False
    if visit and hasattr(visit, 'visioncare_member'):
        visioncare_member = visit.visioncare_member or False
    
    # Get branch info
    branch_address = "GOIL FUEL STATION - BASKET, SPINTEX RD, ACCRA"
    branch_phone = "0548503833 / 0548481866"
    if current_user.branch:
        branch_address = current_user.branch.address or branch_address
        branch_phone = current_user.branch.phone or branch_phone
    
    # Build prescription data for PDF
    prescription_data = {
        "patient": {
            "name": f"{patient.first_name} {patient.last_name}" if patient else "",
            "age": patient_age,
            "sex": patient.gender if patient else "",
            "phone": patient.phone if patient else "",
        },
        "patient_type": patient_type,
        "visioncare_member": visioncare_member,
        "date": prescription.created_at.strftime("%Y-%m-%d") if prescription.created_at else datetime.now().strftime("%Y-%m-%d"),
        "branch_address": branch_address,
        "branch_phone": branch_phone,
        "optometrist_name": f"{doctor.first_name} {doctor.last_name}" if doctor else "",
        
        # Prescription values
        "sphere_od": prescription.sphere_od or "",
        "cylinder_od": prescription.cylinder_od or "",
        "axis_od": prescription.axis_od or "",
        "va_od": prescription.va_od or "",
        "sphere_os": prescription.sphere_os or "",
        "cylinder_os": prescription.cylinder_os or "",
        "axis_os": prescription.axis_os or "",
        "va_os": prescription.va_os or "",
        "add_power": prescription.add_power or "",
        "pd": prescription.pd or "",
        "segment_height": prescription.segment_height or "",
        
        # Lens and frame info
        "lens_type": prescription.lens_type or "",
        "lens_material": prescription.lens_material or "",
        "lens_coating": prescription.lens_coating or "",
        "frame_code": prescription.frame_code or "",
        "frame_size": prescription.frame_size or "",
        "dispensed_by_name": prescription.dispensed_by_name or "",
        "delivery_date": prescription.delivery_date.strftime("%Y-%m-%d") if prescription.delivery_date else "",
        "remarks": prescription.remarks or "",
    }
    
    # Generate PDF
    pdf_bytes = generate_spectacles_prescription_pdf(prescription_data)
    
    # Return PDF response
    patient_name = f"{patient.first_name}_{patient.last_name}" if patient else "patient"
    filename = f"prescription_{patient_name}_{prescription.created_at.strftime('%Y%m%d') if prescription.created_at else 'unknown'}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )
