from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import csv
import io

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.settings import SystemSetting, VisionCareMember, VisitFeeSettings

router = APIRouter()


@router.get("/")
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all system settings"""
    result = await db.execute(select(SystemSetting))
    settings = result.scalars().all()
    return {s.key: s.value for s in settings}


@router.get("/{key}")
async def get_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a specific setting by key"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    if not setting:
        return {"key": key, "value": None}
    return {"key": setting.key, "value": setting.value}


@router.put("/{key}")
async def update_setting(
    key: str,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update or create a system setting"""
    if not current_user.is_superuser and current_user.role not in ['admin', 'doctor', 'optometrist']:
        raise HTTPException(status_code=403, detail="Not authorized to change settings")
    
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.value = data.get("value")
        setting.updated_by_id = current_user.id
    else:
        setting = SystemSetting(
            key=key,
            value=data.get("value"),
            description=data.get("description", ""),
            updated_by_id=current_user.id
        )
        db.add(setting)
    
    await db.commit()
    return {"key": key, "value": setting.value, "message": "Setting updated"}


# VisionCare Membership endpoints
@router.get("/visioncare/members")
async def get_visioncare_members(
    search: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all VisionCare members"""
    query = select(VisionCareMember)
    if active_only:
        query = query.where(VisionCareMember.is_active == True)
    if search:
        query = query.where(
            (VisionCareMember.member_id.ilike(f"%{search}%")) |
            (VisionCareMember.first_name.ilike(f"%{search}%")) |
            (VisionCareMember.last_name.ilike(f"%{search}%")) |
            (VisionCareMember.phone.ilike(f"%{search}%"))
        )
    
    result = await db.execute(query.order_by(VisionCareMember.last_name))
    return result.scalars().all()


@router.get("/visioncare/members/{member_id}")
async def get_visioncare_member(
    member_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if a member ID is valid"""
    result = await db.execute(
        select(VisionCareMember).where(VisionCareMember.member_id == member_id)
    )
    member = result.scalar_one_or_none()
    if not member:
        return {"valid": False, "member": None}
    
    is_valid = member.is_active
    if member.valid_until:
        is_valid = is_valid and member.valid_until > datetime.utcnow()
    
    return {
        "valid": is_valid,
        "member": {
            "id": member.id,
            "member_id": member.member_id,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "company": member.company,
            "plan_type": member.plan_type,
            "valid_until": member.valid_until.isoformat() if member.valid_until else None,
            "is_active": member.is_active
        }
    }


@router.post("/visioncare/members")
async def create_visioncare_member(
    member_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new VisionCare member"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check for duplicate member_id
    existing = await db.execute(
        select(VisionCareMember).where(VisionCareMember.member_id == member_data.get("member_id"))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Member ID already exists")
    
    member = VisionCareMember(
        member_id=member_data.get("member_id"),
        first_name=member_data.get("first_name"),
        last_name=member_data.get("last_name"),
        phone=member_data.get("phone"),
        email=member_data.get("email"),
        company=member_data.get("company"),
        plan_type=member_data.get("plan_type"),
        valid_from=datetime.fromisoformat(member_data["valid_from"]) if member_data.get("valid_from") else None,
        valid_until=datetime.fromisoformat(member_data["valid_until"]) if member_data.get("valid_until") else None,
        is_active=True
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.post("/visioncare/upload")
async def upload_visioncare_members(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Upload VisionCare members from CSV file"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    
    added = 0
    skipped = 0
    errors = []
    
    for row in reader:
        try:
            member_id = row.get('member_id') or row.get('Member ID') or row.get('ID')
            if not member_id:
                skipped += 1
                continue
            
            # Check if exists
            existing = await db.execute(
                select(VisionCareMember).where(VisionCareMember.member_id == member_id)
            )
            if existing.scalar_one_or_none():
                skipped += 1
                continue
            
            member = VisionCareMember(
                member_id=member_id,
                first_name=row.get('first_name') or row.get('First Name') or '',
                last_name=row.get('last_name') or row.get('Last Name') or '',
                phone=row.get('phone') or row.get('Phone') or '',
                email=row.get('email') or row.get('Email') or '',
                company=row.get('company') or row.get('Company') or '',
                plan_type=row.get('plan_type') or row.get('Plan Type') or 'individual',
                is_active=True
            )
            db.add(member)
            added += 1
        except Exception as e:
            errors.append(str(e))
    
    await db.commit()
    
    return {
        "message": f"Upload complete. Added: {added}, Skipped: {skipped}",
        "added": added,
        "skipped": skipped,
        "errors": errors[:5] if errors else []
    }


@router.delete("/visioncare/members/{member_id}")
async def delete_visioncare_member(
    member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Deactivate a VisionCare member"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.execute(select(VisionCareMember).where(VisionCareMember.id == member_id))
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.is_active = False
    await db.commit()
    return {"message": "Member deactivated"}


# ============================================
# VISIT FEE SETTINGS
# ============================================

@router.get("/visit-fees")
async def get_visit_fee_settings(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get visit fee settings (global or branch-specific)"""
    if branch_id:
        result = await db.execute(
            select(VisitFeeSettings).where(VisitFeeSettings.branch_id == branch_id)
        )
    else:
        result = await db.execute(
            select(VisitFeeSettings).where(VisitFeeSettings.branch_id.is_(None))
        )
    
    settings = result.scalar_one_or_none()
    
    if not settings:
        # Return defaults if no settings exist
        return {
            "id": None,
            "branch_id": branch_id,
            "initial_visit_fee": 50.00,
            "review_visit_fee": 30.00,
            "subsequent_visit_fee": 40.00,
            "review_period_days": 7
        }
    
    return {
        "id": settings.id,
        "branch_id": settings.branch_id,
        "initial_visit_fee": float(settings.initial_visit_fee or 0),
        "review_visit_fee": float(settings.review_visit_fee or 0),
        "subsequent_visit_fee": float(settings.subsequent_visit_fee or 0),
        "review_period_days": settings.review_period_days or 7
    }


@router.put("/visit-fees")
async def update_visit_fee_settings(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update visit fee settings (admin only)"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    branch_id = data.get("branch_id")
    
    if branch_id:
        result = await db.execute(
            select(VisitFeeSettings).where(VisitFeeSettings.branch_id == branch_id)
        )
    else:
        result = await db.execute(
            select(VisitFeeSettings).where(VisitFeeSettings.branch_id.is_(None))
        )
    
    settings = result.scalar_one_or_none()
    
    if not settings:
        settings = VisitFeeSettings(branch_id=branch_id)
        db.add(settings)
    
    if "initial_visit_fee" in data:
        settings.initial_visit_fee = data["initial_visit_fee"]
    if "review_visit_fee" in data:
        settings.review_visit_fee = data["review_visit_fee"]
    if "subsequent_visit_fee" in data:
        settings.subsequent_visit_fee = data["subsequent_visit_fee"]
    if "review_period_days" in data:
        settings.review_period_days = data["review_period_days"]
    
    settings.updated_by_id = current_user.id
    settings.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(settings)
    
    return {
        "message": "Visit fee settings updated",
        "id": settings.id,
        "branch_id": settings.branch_id,
        "initial_visit_fee": float(settings.initial_visit_fee or 0),
        "review_visit_fee": float(settings.review_visit_fee or 0),
        "subsequent_visit_fee": float(settings.subsequent_visit_fee or 0),
        "review_period_days": settings.review_period_days
    }
