from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from datetime import datetime

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.clinical import Prescription
from app.models.sales import Sale
from app.models.patient import Visit
from app.utils.pdf_generator import generate_receipt_pdf, generate_prescription_pdf
from app.services.receipts import visit_receipt_data, prescription_receipt_data, sale_receipt_data

router = APIRouter()


@router.get("/prescription/{prescription_id}")
async def get_prescription_receipt(
    prescription_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    data = await prescription_receipt_data(db, prescription_id)
    if not data:
        raise HTTPException(status_code=404, detail="Prescription not found")
    data["served_by"] = data["served_by"] or f"{current_user.first_name} {current_user.last_name}"
    return _pdf(data, f"receipt-{prescription_id}.pdf")


def _pdf(data: dict, filename: str):
    return StreamingResponse(
        generate_receipt_pdf(data),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/sale/{sale_id}")
async def get_sale_receipt(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    data = await sale_receipt_data(db, sale_id)
    if not data:
        raise HTTPException(status_code=404, detail="Sale not found")
    return _pdf(data, f"receipt-{sale_id}.pdf")


@router.get("/prescription-slip/{prescription_id}")
async def get_prescription_slip(
    prescription_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Prescription)
        .options(joinedload(Prescription.patient), joinedload(Prescription.items))
        .where(Prescription.id == prescription_id)
    )
    prescription = result.unique().scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found")
    
    prescription_data = {
        "patient_name": f"{prescription.patient.first_name} {prescription.patient.last_name}" if prescription.patient else "N/A",
        "patient_number": prescription.patient.patient_number if prescription.patient else "N/A",
        "date": prescription.created_at.strftime("%Y-%m-%d") if prescription.created_at else datetime.now().strftime("%Y-%m-%d"),
        "doctor_name": "Dr. " + (current_user.first_name + " " + current_user.last_name),
        "spectacle_rx": {
            "sphere_od": prescription.sphere_od or "",
            "cylinder_od": prescription.cylinder_od or "",
            "axis_od": prescription.axis_od or "",
            "sphere_os": prescription.sphere_os or "",
            "cylinder_os": prescription.cylinder_os or "",
            "axis_os": prescription.axis_os or "",
            "add": prescription.add_power or "",
            "pd": prescription.pd or "",
        } if prescription.sphere_od or prescription.sphere_os else None,
        "items": [
            {
                "name": item.name,
                "dosage": item.dosage,
                "duration": item.duration,
                "description": item.description,
            }
            for item in prescription.items
        ],
    }
    
    pdf_buffer = generate_prescription_pdf(prescription_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=prescription-{prescription.id}.pdf"}
    )


@router.get("/visit/{visit_id}")
async def get_visit_receipt(
    visit_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Generate receipt for visit consultation payment"""
    data = await visit_receipt_data(db, visit_id)
    if not data:
        raise HTTPException(status_code=404, detail="Visit not found")
    return _pdf(data, f"visit-receipt-{visit_id}.pdf")
