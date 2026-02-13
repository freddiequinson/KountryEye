"""Insurance company management and analytics endpoints"""
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
import io
import csv

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.insurance import InsuranceCompany, InsuranceFeeOverride
from app.models.clinical import ConsultationType
from app.models.revenue import Revenue
from app.models.patient import Visit

router = APIRouter()


# Pydantic schemas
class InsuranceCompanyCreate(BaseModel):
    name: str
    code: str
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True


class InsuranceCompanyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    address: Optional[str] = None
    is_active: Optional[bool] = None


class InsuranceFeeOverrideCreate(BaseModel):
    consultation_type_id: int
    override_fee: Optional[float] = None
    initial_fee: Optional[float] = None
    review_fee: Optional[float] = None
    subsequent_fee: Optional[float] = None


class InsuranceFeeOverrideUpdate(BaseModel):
    override_fee: Optional[float] = None
    initial_fee: Optional[float] = None
    review_fee: Optional[float] = None
    subsequent_fee: Optional[float] = None


# CRUD Endpoints
@router.get("")
async def get_insurance_companies(
    include_inactive: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all insurance companies"""
    query = select(InsuranceCompany).options(selectinload(InsuranceCompany.fee_overrides))
    
    if not include_inactive:
        query = query.where(InsuranceCompany.is_active == True)
    
    query = query.order_by(InsuranceCompany.name)
    result = await db.execute(query)
    companies = result.scalars().all()
    
    return [
        {
            "id": c.id,
            "name": c.name,
            "code": c.code,
            "contact_phone": c.contact_phone,
            "contact_email": c.contact_email,
            "address": c.address,
            "is_active": c.is_active,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "fee_overrides_count": len(c.fee_overrides)
        }
        for c in companies
    ]


@router.get("/list")
async def list_insurance_companies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get simple list of active insurance companies for dropdowns"""
    result = await db.execute(
        select(InsuranceCompany)
        .where(InsuranceCompany.is_active == True)
        .order_by(InsuranceCompany.name)
    )
    companies = result.scalars().all()
    
    return [{"id": c.id, "name": c.name, "code": c.code} for c in companies]


@router.post("")
async def create_insurance_company(
    data: InsuranceCompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new insurance company"""
    # Check for duplicate name or code
    existing = await db.execute(
        select(InsuranceCompany).where(
            (InsuranceCompany.name == data.name) | (InsuranceCompany.code == data.code)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Insurance company with this name or code already exists")
    
    company = InsuranceCompany(
        name=data.name,
        code=data.code.upper(),
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
        address=data.address,
        is_active=data.is_active
    )
    db.add(company)
    await db.commit()
    await db.refresh(company)
    
    return {
        "id": company.id,
        "name": company.name,
        "code": company.code,
        "message": "Insurance company created successfully"
    }


@router.get("/{company_id}")
async def get_insurance_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single insurance company with fee overrides"""
    result = await db.execute(
        select(InsuranceCompany)
        .options(selectinload(InsuranceCompany.fee_overrides).selectinload(InsuranceFeeOverride.consultation_type))
        .where(InsuranceCompany.id == company_id)
    )
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Insurance company not found")
    
    return {
        "id": company.id,
        "name": company.name,
        "code": company.code,
        "contact_phone": company.contact_phone,
        "contact_email": company.contact_email,
        "address": company.address,
        "is_active": company.is_active,
        "created_at": company.created_at.isoformat() if company.created_at else None,
        "fee_overrides": [
            {
                "id": fo.id,
                "consultation_type_id": fo.consultation_type_id,
                "consultation_type_name": fo.consultation_type.name if fo.consultation_type else None,
                "override_fee": float(fo.override_fee) if fo.override_fee else None,
                "initial_fee": float(fo.initial_fee) if fo.initial_fee else None,
                "review_fee": float(fo.review_fee) if fo.review_fee else None,
                "subsequent_fee": float(fo.subsequent_fee) if fo.subsequent_fee else None,
            }
            for fo in company.fee_overrides
        ]
    }


@router.put("/{company_id}")
async def update_insurance_company(
    company_id: int,
    data: InsuranceCompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an insurance company"""
    result = await db.execute(
        select(InsuranceCompany).where(InsuranceCompany.id == company_id)
    )
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Insurance company not found")
    
    # Check for duplicate name or code if being changed
    if data.name and data.name != company.name:
        existing = await db.execute(
            select(InsuranceCompany).where(
                InsuranceCompany.name == data.name,
                InsuranceCompany.id != company_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Insurance company with this name already exists")
    
    if data.code and data.code != company.code:
        existing = await db.execute(
            select(InsuranceCompany).where(
                InsuranceCompany.code == data.code.upper(),
                InsuranceCompany.id != company_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Insurance company with this code already exists")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == 'code' and value:
            value = value.upper()
        setattr(company, field, value)
    
    await db.commit()
    await db.refresh(company)
    
    return {"message": "Insurance company updated successfully", "id": company.id}


@router.delete("/{company_id}")
async def delete_insurance_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an insurance company (soft delete by deactivating)"""
    result = await db.execute(
        select(InsuranceCompany).where(InsuranceCompany.id == company_id)
    )
    company = result.scalar_one_or_none()
    
    if not company:
        raise HTTPException(status_code=404, detail="Insurance company not found")
    
    company.is_active = False
    await db.commit()
    
    return {"message": "Insurance company deactivated successfully"}


# Fee Override Endpoints
@router.post("/{company_id}/fee-overrides")
async def create_fee_override(
    company_id: int,
    data: InsuranceFeeOverrideCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a fee override for an insurance company"""
    # Verify company exists
    company_result = await db.execute(
        select(InsuranceCompany).where(InsuranceCompany.id == company_id)
    )
    if not company_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Insurance company not found")
    
    # Check if override already exists for this consultation type
    existing = await db.execute(
        select(InsuranceFeeOverride).where(
            InsuranceFeeOverride.insurance_company_id == company_id,
            InsuranceFeeOverride.consultation_type_id == data.consultation_type_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Fee override already exists for this consultation type")
    
    override = InsuranceFeeOverride(
        insurance_company_id=company_id,
        consultation_type_id=data.consultation_type_id,
        override_fee=Decimal(str(data.override_fee)) if data.override_fee else None,
        initial_fee=Decimal(str(data.initial_fee)) if data.initial_fee else None,
        review_fee=Decimal(str(data.review_fee)) if data.review_fee else None,
        subsequent_fee=Decimal(str(data.subsequent_fee)) if data.subsequent_fee else None,
    )
    db.add(override)
    await db.commit()
    await db.refresh(override)
    
    return {"message": "Fee override created successfully", "id": override.id}


@router.put("/{company_id}/fee-overrides/{override_id}")
async def update_fee_override(
    company_id: int,
    override_id: int,
    data: InsuranceFeeOverrideUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a fee override"""
    result = await db.execute(
        select(InsuranceFeeOverride).where(
            InsuranceFeeOverride.id == override_id,
            InsuranceFeeOverride.insurance_company_id == company_id
        )
    )
    override = result.scalar_one_or_none()
    
    if not override:
        raise HTTPException(status_code=404, detail="Fee override not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(override, field, Decimal(str(value)))
        else:
            setattr(override, field, None)
    
    await db.commit()
    
    return {"message": "Fee override updated successfully"}


@router.delete("/{company_id}/fee-overrides/{override_id}")
async def delete_fee_override(
    company_id: int,
    override_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a fee override"""
    result = await db.execute(
        select(InsuranceFeeOverride).where(
            InsuranceFeeOverride.id == override_id,
            InsuranceFeeOverride.insurance_company_id == company_id
        )
    )
    override = result.scalar_one_or_none()
    
    if not override:
        raise HTTPException(status_code=404, detail="Fee override not found")
    
    await db.delete(override)
    await db.commit()
    
    return {"message": "Fee override deleted successfully"}


# Analytics Endpoints
@router.get("/analytics/summary")
async def get_insurance_analytics_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get insurance analytics summary - total owed by each company"""
    
    # Get all insurance revenue grouped by provider
    query = select(
        Visit.insurance_provider,
        func.count(Visit.id).label('visit_count'),
        func.sum(Visit.insurance_used).label('total_used'),
        func.sum(Visit.consultation_fee).label('total_fees')
    ).where(
        Visit.payment_type == 'insurance',
        Visit.insurance_provider != None
    )
    
    if start_date:
        query = query.where(func.date(Visit.visit_date) >= start_date)
    if end_date:
        query = query.where(func.date(Visit.visit_date) <= end_date)
    
    query = query.group_by(Visit.insurance_provider)
    
    result = await db.execute(query)
    rows = result.all()
    
    # Also get revenue records for insurance payments
    revenue_query = select(
        Revenue.description,
        func.sum(Revenue.amount).label('total_amount')
    ).where(
        Revenue.payment_method == 'insurance'
    )
    
    if start_date:
        revenue_query = revenue_query.where(func.date(Revenue.created_at) >= start_date)
    if end_date:
        revenue_query = revenue_query.where(func.date(Revenue.created_at) <= end_date)
    
    revenue_query = revenue_query.group_by(Revenue.description)
    
    # Build summary by provider
    summary = []
    total_owed = 0
    total_visits = 0
    
    for row in rows:
        provider = row[0] or "Unknown"
        visit_count = row[1] or 0
        insurance_used = float(row[2] or 0)
        
        summary.append({
            "provider": provider,
            "visit_count": visit_count,
            "total_owed": insurance_used,
        })
        total_owed += insurance_used
        total_visits += visit_count
    
    return {
        "summary": sorted(summary, key=lambda x: x['total_owed'], reverse=True),
        "totals": {
            "total_owed": total_owed,
            "total_visits": total_visits,
            "provider_count": len(summary)
        },
        "period": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None
        }
    }


@router.get("/analytics/monthly")
async def get_insurance_monthly_breakdown(
    year: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get monthly breakdown of insurance payments"""
    if not year:
        year = datetime.now().year
    
    # Get visits grouped by month and provider
    query = select(
        func.extract('month', Visit.visit_date).label('month'),
        Visit.insurance_provider,
        func.count(Visit.id).label('visit_count'),
        func.sum(Visit.insurance_used).label('total_used')
    ).where(
        Visit.payment_type == 'insurance',
        func.extract('year', Visit.visit_date) == year
    ).group_by(
        func.extract('month', Visit.visit_date),
        Visit.insurance_provider
    ).order_by(
        func.extract('month', Visit.visit_date)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    # Organize by month
    monthly_data = {}
    for row in rows:
        month = int(row[0])
        provider = row[1] or "Unknown"
        visit_count = row[2] or 0
        total_used = float(row[3] or 0)
        
        if month not in monthly_data:
            monthly_data[month] = {"month": month, "providers": {}, "total": 0, "visit_count": 0}
        
        monthly_data[month]["providers"][provider] = {
            "visit_count": visit_count,
            "amount": total_used
        }
        monthly_data[month]["total"] += total_used
        monthly_data[month]["visit_count"] += visit_count
    
    return {
        "year": year,
        "monthly_breakdown": [monthly_data.get(m, {"month": m, "providers": {}, "total": 0, "visit_count": 0}) for m in range(1, 13)]
    }


@router.get("/analytics/detailed")
async def get_insurance_detailed_report(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    provider: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get detailed insurance payment records"""
    from app.models.patient import Patient
    
    query = select(Visit).options(
        selectinload(Visit.patient)
    ).where(
        Visit.payment_type == 'insurance'
    )
    
    if start_date:
        query = query.where(func.date(Visit.visit_date) >= start_date)
    if end_date:
        query = query.where(func.date(Visit.visit_date) <= end_date)
    if provider:
        query = query.where(Visit.insurance_provider == provider)
    
    query = query.order_by(Visit.visit_date.desc())
    
    result = await db.execute(query)
    visits = result.scalars().all()
    
    records = []
    for v in visits:
        patient_name = f"{v.patient.first_name} {v.patient.last_name}" if v.patient else "Unknown"
        records.append({
            "id": v.id,
            "visit_number": v.visit_number,
            "visit_date": v.visit_date.strftime("%Y-%m-%d") if v.visit_date else None,
            "patient_name": patient_name,
            "patient_phone": v.patient.phone if v.patient else None,
            "insurance_provider": v.insurance_provider,
            "insurance_id": v.insurance_id,
            "insurance_number": v.insurance_number,
            "insurance_limit": float(v.insurance_limit or 0),
            "insurance_used": float(v.insurance_used or 0),
            "consultation_fee": float(v.consultation_fee or 0),
            "visit_type": v.visit_type.value if v.visit_type else None,
        })
    
    return {
        "records": records,
        "count": len(records),
        "total_insurance_used": sum(r["insurance_used"] for r in records)
    }


@router.get("/analytics/export")
async def export_insurance_analytics(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    provider: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Export insurance analytics as CSV"""
    from app.models.patient import Patient
    
    query = select(Visit).options(
        selectinload(Visit.patient)
    ).where(
        Visit.payment_type == 'insurance'
    )
    
    if start_date:
        query = query.where(func.date(Visit.visit_date) >= start_date)
    if end_date:
        query = query.where(func.date(Visit.visit_date) <= end_date)
    if provider:
        query = query.where(Visit.insurance_provider == provider)
    
    query = query.order_by(Visit.visit_date.desc())
    
    result = await db.execute(query)
    visits = result.scalars().all()
    
    # Create CSV
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        "Visit Number",
        "Visit Date",
        "Patient Name",
        "Patient Phone",
        "Insurance Provider",
        "Insurance ID",
        "Insurance Number",
        "Insurance Limit",
        "Insurance Used",
        "Consultation Fee",
        "Visit Type"
    ])
    
    # Data rows
    for v in visits:
        patient_name = f"{v.patient.first_name} {v.patient.last_name}" if v.patient else "Unknown"
        writer.writerow([
            v.visit_number,
            v.visit_date.strftime("%Y-%m-%d") if v.visit_date else "",
            patient_name,
            v.patient.phone if v.patient else "",
            v.insurance_provider or "",
            v.insurance_id or "",
            v.insurance_number or "",
            float(v.insurance_limit or 0),
            float(v.insurance_used or 0),
            float(v.consultation_fee or 0),
            v.visit_type.value if v.visit_type else ""
        ])
    
    output.seek(0)
    
    # Generate filename
    filename = f"insurance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
