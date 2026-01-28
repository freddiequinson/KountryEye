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

router = APIRouter()


@router.get("/prescription/{prescription_id}")
async def get_prescription_receipt(
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
    
    receipt_data = {
        "receipt_number": f"RX-{prescription.id:06d}",
        "date": prescription.created_at.strftime("%Y-%m-%d %H:%M") if prescription.created_at else datetime.now().strftime("%Y-%m-%d %H:%M"),
        "branch": "Main Branch",
        "patient_name": f"{prescription.patient.first_name} {prescription.patient.last_name}" if prescription.patient else "N/A",
        "patient_number": prescription.patient.patient_number if prescription.patient else "N/A",
        "items": [
            {
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price) if item.unit_price else 0,
            }
            for item in prescription.items
        ],
        "subtotal": float(prescription.total_amount) if prescription.total_amount else 0,
        "discount": 0,
        "total": float(prescription.total_amount) if prescription.total_amount else 0,
        "payment_method": prescription.payment_method or "Cash",
        "amount_paid": float(prescription.total_amount) if prescription.total_amount else 0,
        "served_by": current_user.first_name + " " + current_user.last_name,
    }
    
    pdf_buffer = generate_receipt_pdf(receipt_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=receipt-{prescription.id}.pdf"}
    )


@router.get("/sale/{sale_id}")
async def get_sale_receipt(
    sale_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Sale)
        .options(joinedload(Sale.items))
        .where(Sale.id == sale_id)
    )
    sale = result.unique().scalar_one_or_none()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    receipt_data = {
        "receipt_number": f"SL-{sale.id:06d}",
        "date": sale.created_at.strftime("%Y-%m-%d %H:%M") if sale.created_at else datetime.now().strftime("%Y-%m-%d %H:%M"),
        "branch": "Main Branch",
        "patient_name": "Walk-in Customer",
        "patient_number": "N/A",
        "items": [
            {
                "name": item.product.name if item.product else f"Product #{item.product_id}",
                "quantity": item.quantity,
                "unit_price": float(item.unit_price) if item.unit_price else 0,
            }
            for item in sale.items
        ],
        "subtotal": float(sale.subtotal) if sale.subtotal else 0,
        "discount": float(sale.discount_amount) if sale.discount_amount else 0,
        "total": float(sale.total_amount) if sale.total_amount else 0,
        "payment_method": sale.payment_method or "Cash",
        "amount_paid": float(sale.total_amount) if sale.total_amount else 0,
        "served_by": current_user.first_name + " " + current_user.last_name,
    }
    
    pdf_buffer = generate_receipt_pdf(receipt_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=receipt-{sale.id}.pdf"}
    )


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
    db: AsyncSession = Depends(get_db)
):
    """Generate receipt for visit consultation payment"""
    result = await db.execute(
        select(Visit)
        .options(joinedload(Visit.patient))
        .where(Visit.id == visit_id)
    )
    visit = result.unique().scalar_one_or_none()
    
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")
    
    receipt_data = {
        "receipt_number": f"VIS-{visit.id:06d}",
        "date": visit.visit_date.strftime("%Y-%m-%d %H:%M") if visit.visit_date else datetime.now().strftime("%Y-%m-%d %H:%M"),
        "branch": "Main Branch",
        "patient_name": f"{visit.patient.first_name} {visit.patient.last_name}" if visit.patient else "N/A",
        "patient_number": visit.patient.patient_number if visit.patient else "N/A",
        "items": [
            {
                "name": "Consultation Fee",
                "quantity": 1,
                "unit_price": float(visit.consultation_fee) if visit.consultation_fee else 0,
            }
        ],
        "subtotal": float(visit.consultation_fee) if visit.consultation_fee else 0,
        "discount": 0,
        "total": float(visit.consultation_fee) if visit.consultation_fee else 0,
        "payment_method": "Cash",
        "amount_paid": float(visit.amount_paid) if visit.amount_paid else 0,
        "served_by": "Front Desk",
    }
    
    pdf_buffer = generate_receipt_pdf(receipt_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=visit-receipt-{visit.id}.pdf"}
    )
