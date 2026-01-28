from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
import os
import uuid

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.asset import AssetCategory, Asset, MaintenanceLog, Technician
from app.models.accounting import Expense
from app.schemas.asset import (
    AssetCategoryCreate, AssetCategoryUpdate, AssetCategoryResponse,
    AssetCreate, AssetUpdate, AssetResponse,
    MaintenanceLogCreate, MaintenanceLogResponse,
    MaintenanceReportItem,
    TechnicianCreate, TechnicianUpdate, TechnicianResponse
)

router = APIRouter()


def generate_asset_tag(count: int) -> str:
    return f"AST-{count:06d}"


@router.get("/categories", response_model=List[AssetCategoryResponse])
async def get_asset_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(AssetCategory))
    return result.scalars().all()


@router.post("/categories", response_model=AssetCategoryResponse)
async def create_asset_category(
    category_in: AssetCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    category = AssetCategory(**category_in.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=AssetCategoryResponse)
async def update_asset_category(
    category_id: int,
    category_in: AssetCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an asset category including its default checklist"""
    result = await db.execute(select(AssetCategory).where(AssetCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for field, value in category_in.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    
    await db.commit()
    await db.refresh(category)
    return category


@router.get("/categories/{category_id}", response_model=AssetCategoryResponse)
async def get_asset_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single asset category with its default checklist"""
    result = await db.execute(select(AssetCategory).where(AssetCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


# Technician endpoints - MUST be before /{asset_id} routes
@router.get("/technicians", response_model=List[TechnicianResponse])
async def get_technicians(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all technicians"""
    query = select(Technician)
    if active_only:
        query = query.where(Technician.is_active == True)
    query = query.order_by(Technician.name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/technicians", response_model=TechnicianResponse)
async def create_technician(
    tech_in: TechnicianCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new technician"""
    technician = Technician(**tech_in.model_dump())
    db.add(technician)
    await db.commit()
    await db.refresh(technician)
    return technician


@router.put("/technicians/{technician_id}", response_model=TechnicianResponse)
async def update_technician(
    technician_id: int,
    tech_in: TechnicianUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a technician"""
    result = await db.execute(select(Technician).where(Technician.id == technician_id))
    technician = result.scalar_one_or_none()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    for field, value in tech_in.model_dump(exclude_unset=True).items():
        setattr(technician, field, value)
    
    await db.commit()
    await db.refresh(technician)
    return technician


@router.delete("/technicians/{technician_id}")
async def delete_technician(
    technician_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Deactivate a technician"""
    result = await db.execute(select(Technician).where(Technician.id == technician_id))
    technician = result.scalar_one_or_none()
    if not technician:
        raise HTTPException(status_code=404, detail="Technician not found")
    
    technician.is_active = False
    await db.commit()
    return {"message": "Technician deactivated"}


@router.get("", response_model=List[AssetResponse])
async def get_assets(
    branch_id: Optional[int] = None,
    category_id: Optional[int] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    maintenance_due: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Asset).options(
        selectinload(Asset.category),
        selectinload(Asset.branch)
    ).where(Asset.is_active == True)
    
    if branch_id:
        query = query.where(Asset.branch_id == branch_id)
    if category_id:
        query = query.where(Asset.category_id == category_id)
    if status:
        query = query.where(Asset.status == status)
    if search:
        query = query.where(
            or_(
                Asset.name.ilike(f"%{search}%"),
                Asset.asset_tag.ilike(f"%{search}%"),
                Asset.serial_number.ilike(f"%{search}%")
            )
        )
    if maintenance_due:
        query = query.where(Asset.next_maintenance_date <= date.today())
    
    result = await db.execute(query.order_by(Asset.name))
    return result.scalars().all()


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(Asset).options(
            selectinload(Asset.category),
            selectinload(Asset.branch)
        ).where(Asset.id == asset_id)
    )
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.post("", response_model=AssetResponse)
async def create_asset(
    asset_in: AssetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    count_result = await db.execute(select(func.count(Asset.id)))
    count = count_result.scalar() + 1
    
    asset_tag = asset_in.asset_tag or generate_asset_tag(count)
    
    asset = Asset(**asset_in.model_dump(exclude={"asset_tag"}), asset_tag=asset_tag)
    db.add(asset)
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Asset).options(
            selectinload(Asset.category),
            selectinload(Asset.branch)
        ).where(Asset.id == asset.id)
    )
    return result.scalar_one()


@router.put("/{asset_id}", response_model=AssetResponse)
async def update_asset(
    asset_id: int,
    asset_in: AssetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    for field, value in asset_in.model_dump(exclude_unset=True).items():
        setattr(asset, field, value)
    
    await db.commit()
    
    # Re-fetch with relationships loaded
    result = await db.execute(
        select(Asset).options(
            selectinload(Asset.category),
            selectinload(Asset.branch)
        ).where(Asset.id == asset_id)
    )
    return result.scalar_one()


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    asset.is_active = False
    await db.commit()
    return {"message": "Asset deactivated"}


@router.get("/{asset_id}/maintenance", response_model=List[MaintenanceLogResponse])
async def get_asset_maintenance_logs(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(
        select(MaintenanceLog)
        .where(MaintenanceLog.asset_id == asset_id)
        .order_by(MaintenanceLog.performed_date.desc())
    )
    return result.scalars().all()


@router.post("/maintenance", response_model=MaintenanceLogResponse)
async def create_maintenance_log(
    log_in: MaintenanceLogCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    asset_result = await db.execute(
        select(Asset).options(selectinload(Asset.branch)).where(Asset.id == log_in.asset_id)
    )
    asset = asset_result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    log = MaintenanceLog(**log_in.model_dump(), created_by_id=current_user.id)
    db.add(log)
    
    asset.last_maintenance_date = log_in.performed_date
    if log_in.next_due_date:
        asset.next_maintenance_date = log_in.next_due_date
    elif asset.maintenance_interval_days:
        asset.next_maintenance_date = log_in.performed_date + timedelta(days=asset.maintenance_interval_days)
    
    # Record maintenance cost as expense if cost is provided
    # BUT skip if linked to a fund request (expense already recorded via fund request)
    if log_in.cost and log_in.cost > 0 and not log_in.fund_request_id:
        expense = Expense(
            description=f"Maintenance for {asset.name} ({asset.asset_tag}) - {log_in.maintenance_type or 'General'}",
            amount=log_in.cost,
            expense_date=log_in.performed_date,
            branch_id=asset.branch_id,
            recorded_by_id=current_user.id
        )
        db.add(expense)
    
    await db.commit()
    await db.refresh(log)
    return log


@router.post("/{asset_id}/image")
async def upload_asset_image(
    asset_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload an image for an asset"""
    result = await db.execute(select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Create uploads directory if it doesn't exist
    upload_dir = "uploads/assets"
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1] if file.filename else ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)
    
    # Save file
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    
    # Update asset with image URL
    asset.image_url = f"/uploads/assets/{filename}"
    await db.commit()
    
    return {"image_url": asset.image_url}


@router.get("/reports/maintenance-due", response_model=List[MaintenanceReportItem])
async def get_maintenance_due_report(
    branch_id: Optional[int] = None,
    include_overdue: bool = True,
    days_ahead: int = 7,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get assets that need maintenance"""
    query = select(Asset).options(
        selectinload(Asset.branch)
    ).where(Asset.is_active == True)
    
    if branch_id:
        query = query.where(Asset.branch_id == branch_id)
    
    today = date.today()
    future_date = today + timedelta(days=days_ahead)
    
    if include_overdue:
        query = query.where(Asset.next_maintenance_date <= future_date)
    else:
        query = query.where(
            Asset.next_maintenance_date > today,
            Asset.next_maintenance_date <= future_date
        )
    
    result = await db.execute(query.order_by(Asset.next_maintenance_date))
    assets = result.scalars().all()
    
    report = []
    for asset in assets:
        days_overdue = None
        if asset.next_maintenance_date and asset.next_maintenance_date < today:
            days_overdue = (today - asset.next_maintenance_date).days
        
        report.append(MaintenanceReportItem(
            asset_id=asset.id,
            asset_tag=asset.asset_tag,
            asset_name=asset.name,
            branch_name=asset.branch.name if asset.branch else None,
            last_maintenance=asset.last_maintenance_date,
            next_maintenance=asset.next_maintenance_date,
            days_overdue=days_overdue,
            status=asset.status,
            condition=asset.condition
        ))
    
    return report


@router.get("/reports/health")
async def get_asset_health_report(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Asset).options(
        selectinload(Asset.branch)
    ).where(Asset.is_active == True)
    if branch_id:
        query = query.where(Asset.branch_id == branch_id)
    
    result = await db.execute(query)
    assets = result.scalars().all()
    
    total = len(assets)
    by_condition = {}
    by_status = {}
    by_branch = {}
    maintenance_due = 0
    warranty_expiring = 0
    
    today = date.today()
    thirty_days = today + timedelta(days=30)
    
    for asset in assets:
        by_condition[asset.condition] = by_condition.get(asset.condition, 0) + 1
        by_status[asset.status] = by_status.get(asset.status, 0) + 1
        
        branch_name = asset.branch.name if asset.branch else "Unassigned"
        by_branch[branch_name] = by_branch.get(branch_name, 0) + 1
        
        if asset.next_maintenance_date and asset.next_maintenance_date <= today:
            maintenance_due += 1
        if asset.warranty_expiry and asset.warranty_expiry <= thirty_days:
            warranty_expiring += 1
    
    return {
        "total_assets": total,
        "by_condition": by_condition,
        "by_status": by_status,
        "by_branch": by_branch,
        "maintenance_due": maintenance_due,
        "warranty_expiring_soon": warranty_expiring
    }
