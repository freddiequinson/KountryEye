from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import async_session_maker, engine, Base, get_db
from app.core.security import get_password_hash
from app.models import User, Role, Branch, ConsultationType, ProductCategory, IncomeCategory, ExpenseCategory, AssetCategory
from app.models.user import Permission
from app.api.v1.deps import get_current_active_user
import subprocess
import os
from typing import Optional
from datetime import datetime

router = APIRouter()

RESET_PASSWORD = "21Savage"

class ResetRequest(BaseModel):
    password: str
    reseed: bool = True


@router.post("/hard-reset")
async def hard_reset_database(request: ResetRequest):
    """
    Hard reset the entire database. This will delete ALL data.
    Requires the system reset password.
    """
    if request.password != RESET_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid reset password")
    
    try:
        # Drop all tables and recreate them
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
        
        if request.reseed:
            # Reseed with initial data
            async with async_session_maker() as session:
                # Create admin role
                role = Role(name="admin", description="Administrator with full access")
                session.add(role)
                await session.flush()

                # Create admin user
                admin_user = User(
                    email="admin@kountryeyecare.com",
                    hashed_password=get_password_hash("admin123"),
                    first_name="System",
                    last_name="Administrator",
                    role_id=role.id,
                    is_active=True,
                    is_superuser=True
                )
                session.add(admin_user)

                # Create other roles
                frontdesk_role = Role(name="frontdesk", description="Front desk staff")
                doctor_role = Role(name="doctor", description="Medical doctors")
                marketing_role = Role(name="marketing", description="Marketing team")
                session.add_all([frontdesk_role, doctor_role, marketing_role])

                # Create main branch
                main_branch = Branch(
                    name="Kountry Eyecare Main",
                    address="123 Main Street, Lagos",
                    phone="+234 800 000 0001",
                    email="main@kountryeyecare.com",
                    is_active=True
                )
                session.add(main_branch)

                # Create consultation types
                consultation_types = [
                    ConsultationType(name="General Eye Exam", description="Comprehensive eye examination", base_fee=5000),
                    ConsultationType(name="Pediatric Eye Exam", description="Eye examination for children", base_fee=4000),
                    ConsultationType(name="Contact Lens Fitting", description="Contact lens consultation and fitting", base_fee=7500),
                    ConsultationType(name="Glaucoma Screening", description="Glaucoma detection and monitoring", base_fee=8000),
                    ConsultationType(name="Diabetic Eye Exam", description="Eye examination for diabetic patients", base_fee=6000),
                ]
                session.add_all(consultation_types)

                # Create product categories
                product_categories = [
                    ProductCategory(name="Frames", description="Eyeglass frames"),
                    ProductCategory(name="Lenses", description="Prescription and non-prescription lenses"),
                    ProductCategory(name="Contact Lenses", description="Contact lenses"),
                    ProductCategory(name="Sunglasses", description="Sunglasses and tinted lenses"),
                    ProductCategory(name="Eye Drops", description="Eye drops and medications"),
                    ProductCategory(name="Accessories", description="Cases, cleaning solutions, etc."),
                ]
                session.add_all(product_categories)

                # Create income categories
                income_categories = [
                    IncomeCategory(name="Consultation Fees", description="Income from consultations"),
                    IncomeCategory(name="Product Sales", description="Income from product sales"),
                    IncomeCategory(name="Services", description="Income from services"),
                    IncomeCategory(name="Other", description="Other income sources"),
                ]
                session.add_all(income_categories)

                # Create expense categories
                expense_categories = [
                    ExpenseCategory(name="Salaries", description="Staff salaries and wages"),
                    ExpenseCategory(name="Rent", description="Office rent"),
                    ExpenseCategory(name="Utilities", description="Electricity, water, internet"),
                    ExpenseCategory(name="Inventory", description="Stock purchases"),
                    ExpenseCategory(name="Equipment", description="Equipment and maintenance"),
                    ExpenseCategory(name="Marketing", description="Marketing and advertising"),
                    ExpenseCategory(name="Other", description="Miscellaneous expenses"),
                ]
                session.add_all(expense_categories)

                # Create asset categories
                asset_categories = [
                    AssetCategory(name="Medical Equipment", description="Diagnostic and treatment equipment"),
                    AssetCategory(name="Furniture", description="Office furniture"),
                    AssetCategory(name="IT Equipment", description="Computers, printers, etc."),
                    AssetCategory(name="Vehicles", description="Company vehicles"),
                ]
                session.add_all(asset_categories)

                await session.commit()
                
                # Seed permissions and assign to roles
                await seed_permissions_and_roles(session)
        
        return {
            "success": True,
            "message": "Database has been reset successfully",
            "reseeded": request.reseed,
            "admin_credentials": {
                "email": "admin@kountryeyecare.com",
                "password": "admin123"
            } if request.reseed else None
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Reset failed: {str(e)}")


async def seed_permissions_and_roles(session):
    """Seed default permissions and assign them to roles"""
    DEFAULT_PERMISSIONS = [
        {'name': 'View Dashboard', 'code': 'dashboard.view', 'module': 'dashboard'},
        {'name': 'View Admin Dashboard', 'code': 'dashboard.admin', 'module': 'dashboard'},
        {'name': 'View Doctor Dashboard', 'code': 'dashboard.doctor', 'module': 'dashboard'},
        {'name': 'View Front Desk Dashboard', 'code': 'dashboard.frontdesk', 'module': 'dashboard'},
        {'name': 'View Marketing Dashboard', 'code': 'dashboard.marketing', 'module': 'dashboard'},
        {'name': 'View Patients', 'code': 'patients.view', 'module': 'patients'},
        {'name': 'Create Patients', 'code': 'patients.create', 'module': 'patients'},
        {'name': 'Edit Patients', 'code': 'patients.edit', 'module': 'patients'},
        {'name': 'View Visits', 'code': 'visits.view', 'module': 'visits'},
        {'name': 'Create Visits', 'code': 'visits.create', 'module': 'visits'},
        {'name': 'Check-in Patients', 'code': 'visits.checkin', 'module': 'visits'},
        {'name': 'View Consultations', 'code': 'clinical.view', 'module': 'clinical'},
        {'name': 'Create Consultations', 'code': 'clinical.create', 'module': 'clinical'},
        {'name': 'View Prescriptions', 'code': 'prescriptions.view', 'module': 'clinical'},
        {'name': 'Create Prescriptions', 'code': 'prescriptions.create', 'module': 'clinical'},
        {'name': 'Access Doctor Queue', 'code': 'clinical.queue', 'module': 'clinical'},
        {'name': 'Access POS', 'code': 'pos.access', 'module': 'sales'},
        {'name': 'View Sales', 'code': 'sales.view', 'module': 'sales'},
        {'name': 'Create Sales', 'code': 'sales.create', 'module': 'sales'},
        {'name': 'View Payments', 'code': 'payments.view', 'module': 'payments'},
        {'name': 'Process Payments', 'code': 'payments.create', 'module': 'payments'},
        {'name': 'Generate Receipts', 'code': 'receipts.generate', 'module': 'payments'},
        {'name': 'View Inventory', 'code': 'inventory.view', 'module': 'inventory'},
        {'name': 'Manage Inventory', 'code': 'inventory.manage', 'module': 'inventory'},
        {'name': 'View Assets', 'code': 'assets.view', 'module': 'assets'},
        {'name': 'View Marketing', 'code': 'marketing.view', 'module': 'marketing'},
        {'name': 'Manage Events', 'code': 'marketing.events', 'module': 'marketing'},
        {'name': 'View Ratings', 'code': 'marketing.ratings', 'module': 'marketing'},
        {'name': 'View Employees', 'code': 'employees.view', 'module': 'employees'},
        {'name': 'Manage Employees', 'code': 'employees.manage', 'module': 'employees'},
        {'name': 'View Branches', 'code': 'branches.view', 'module': 'branches'},
        {'name': 'Manage Branches', 'code': 'branches.manage', 'module': 'branches'},
        {'name': 'View Settings', 'code': 'settings.view', 'module': 'settings'},
        {'name': 'Manage Settings', 'code': 'settings.manage', 'module': 'settings'},
        {'name': 'Manage Permissions', 'code': 'permissions.manage', 'module': 'settings'},
        {'name': 'View Revenue', 'code': 'revenue.view', 'module': 'accounting'},
        {'name': 'View Accounting', 'code': 'accounting.view', 'module': 'accounting'},
        {'name': 'Clock In/Out', 'code': 'attendance.clock', 'module': 'attendance'},
        {'name': 'View Own Attendance', 'code': 'attendance.view_own', 'module': 'attendance'},
        {'name': 'View All Attendance', 'code': 'attendance.view_all', 'module': 'attendance'},
        {'name': 'View Attendance', 'code': 'attendance.view', 'module': 'attendance'},
        {'name': 'View Analytics', 'code': 'analytics.view', 'module': 'analytics'},
        {'name': 'View Fund Requests', 'code': 'fund_requests.view', 'module': 'fund_requests'},
        {'name': 'Create Fund Requests', 'code': 'fund_requests.create', 'module': 'fund_requests'},
        {'name': 'View Messages', 'code': 'messages.view', 'module': 'messaging'},
        {'name': 'Send Messages', 'code': 'messages.send', 'module': 'messaging'},
    ]

    ROLE_PERMISSIONS = {
        'doctor': [
            'dashboard.view', 'dashboard.doctor',
            'patients.view', 'patients.edit',
            'visits.view',
            'clinical.view', 'clinical.create', 'clinical.queue',
            'prescriptions.view', 'prescriptions.create',
            'pos.access', 'sales.view', 'sales.create',
            'payments.view', 'receipts.generate',
            'attendance.clock', 'attendance.view_own', 'attendance.view',
            'fund_requests.view', 'fund_requests.create',
            'messages.view', 'messages.send',
        ],
        'frontdesk': [
            'dashboard.view', 'dashboard.frontdesk',
            'patients.view', 'patients.create', 'patients.edit',
            'visits.view', 'visits.create', 'visits.checkin',
            'pos.access', 'sales.view', 'sales.create',
            'payments.view', 'payments.create', 'receipts.generate',
            'attendance.clock', 'attendance.view_own', 'attendance.view',
            'fund_requests.view', 'fund_requests.create',
            'messages.view', 'messages.send',
        ],
        'marketing': [
            'dashboard.view', 'dashboard.marketing',
            'marketing.view', 'marketing.events', 'marketing.ratings',
            'patients.view',
            'attendance.clock', 'attendance.view_own', 'attendance.view',
            'fund_requests.view', 'fund_requests.create',
            'messages.view', 'messages.send',
        ],
        'admin': [
            'dashboard.view', 'dashboard.admin', 'dashboard.doctor', 'dashboard.frontdesk', 'dashboard.marketing',
            'patients.view', 'patients.create', 'patients.edit',
            'visits.view', 'visits.create', 'visits.checkin',
            'clinical.view', 'clinical.create', 'clinical.queue',
            'prescriptions.view', 'prescriptions.create',
            'pos.access', 'sales.view', 'sales.create',
            'payments.view', 'payments.create', 'receipts.generate',
            'inventory.view', 'inventory.manage',
            'assets.view',
            'marketing.view', 'marketing.events', 'marketing.ratings',
            'employees.view', 'employees.manage',
            'branches.view', 'branches.manage',
            'settings.view', 'settings.manage', 'permissions.manage',
            'revenue.view', 'accounting.view',
            'attendance.clock', 'attendance.view_own', 'attendance.view_all', 'attendance.view',
            'analytics.view',
            'fund_requests.view', 'fund_requests.create',
            'messages.view', 'messages.send',
        ],
    }

    # Create permissions
    for perm_data in DEFAULT_PERMISSIONS:
        existing = await session.execute(select(Permission).where(Permission.code == perm_data['code']))
        if not existing.scalar_one_or_none():
            perm = Permission(**perm_data)
            session.add(perm)
    await session.commit()
    
    # Get all permissions
    all_perms_result = await session.execute(select(Permission))
    all_permissions = {p.code: p for p in all_perms_result.scalars().all()}
    
    # Assign permissions to roles
    for role_name, perm_codes in ROLE_PERMISSIONS.items():
        result = await session.execute(
            select(Role).options(selectinload(Role.permissions)).where(Role.name == role_name)
        )
        role = result.scalar_one_or_none()
        if role:
            permissions = [all_permissions[code] for code in perm_codes if code in all_permissions]
            role.permissions = permissions
    
    await session.commit()


@router.get("/logs")
async def get_system_logs(
    lines: int = Query(default=100, le=500),
    filter_type: Optional[str] = Query(default=None, description="Filter: error, warning, info"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get system logs - admin only"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    parsed_logs = []
    errors = None
    
    # Try multiple log sources
    log_sources = [
        "/var/log/kountryeye/app.log",
        "/var/www/kountryeye/backend/app.log",
        "/var/log/syslog",
    ]
    
    log_file = None
    for source in log_sources:
        if os.path.exists(source):
            log_file = source
            break
    
    if log_file:
        try:
            # Read last N lines from log file
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                all_lines = f.readlines()
                log_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            
            for line in log_lines:
                line = line.strip()
                if not line:
                    continue
                
                # Apply filter
                if filter_type == "error" and "error" not in line.lower():
                    continue
                elif filter_type == "warning" and "warning" not in line.lower() and "warn" not in line.lower():
                    continue
                
                # Detect log level
                level = "info"
                if "error" in line.lower() or "exception" in line.lower() or "traceback" in line.lower():
                    level = "error"
                elif "warning" in line.lower() or "warn" in line.lower():
                    level = "warning"
                elif "debug" in line.lower():
                    level = "debug"
                
                parsed_logs.append({
                    "timestamp": datetime.utcnow().isoformat(),
                    "level": level,
                    "message": line
                })
        except Exception as e:
            errors = f"Error reading log file: {str(e)}"
    
    # If no file logs, try to get recent API request logs from memory
    if not parsed_logs:
        # Add some system info as fallback
        parsed_logs.append({
            "timestamp": datetime.utcnow().isoformat(),
            "level": "info",
            "message": f"System is running. Log file not found at: {', '.join(log_sources)}"
        })
        parsed_logs.append({
            "timestamp": datetime.utcnow().isoformat(),
            "level": "info",
            "message": f"Current working directory: {os.getcwd()}"
        })
        parsed_logs.append({
            "timestamp": datetime.utcnow().isoformat(),
            "level": "info",
            "message": f"Python version: {subprocess.run(['python3', '--version'], capture_output=True, text=True).stdout.strip() if os.name != 'nt' else 'N/A'}"
        })
        
        # Try journalctl with full path
        try:
            result = subprocess.run(
                ["/usr/bin/journalctl", "-u", "kountryeye", "-n", str(lines), "--no-pager"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.stdout:
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        level = "info"
                        if "error" in line.lower():
                            level = "error"
                        elif "warning" in line.lower():
                            level = "warning"
                        parsed_logs.append({
                            "timestamp": datetime.utcnow().isoformat(),
                            "level": level,
                            "message": line
                        })
        except Exception:
            pass
    
    return {
        "logs": parsed_logs,
        "total": len(parsed_logs),
        "errors": errors
    }


@router.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/logs/download")
async def download_error_logs(
    current_user: User = Depends(get_current_active_user)
):
    """Download error logs as a text file - admin only"""
    from fastapi.responses import Response
    
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    error_logs = []
    
    # Try multiple log sources
    log_sources = [
        "/var/log/kountryeye/app.log",
        "/var/www/kountryeye/backend/app.log",
        "/var/log/syslog",
    ]
    
    for source in log_sources:
        if os.path.exists(source):
            try:
                with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                    for line in f:
                        line = line.strip()
                        if line and ("error" in line.lower() or "exception" in line.lower() or "traceback" in line.lower()):
                            error_logs.append(line)
            except Exception as e:
                error_logs.append(f"Error reading {source}: {str(e)}")
    
    # Create downloadable content
    content = f"KountryEye Error Logs - Generated: {datetime.utcnow().isoformat()}\n"
    content += "=" * 80 + "\n\n"
    
    if error_logs:
        content += "\n".join(error_logs[-500:])  # Last 500 error lines
    else:
        content += "No errors found in log files."
    
    return Response(
        content=content,
        media_type="text/plain",
        headers={
            "Content-Disposition": f"attachment; filename=kountryeye_errors_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.txt"
        }
    )


@router.get("/logs/errors-summary")
async def get_errors_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get summary of recent errors for quick tracking - admin only"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Admin access required")
    
    error_summary = {
        "total_errors": 0,
        "error_types": {},
        "recent_errors": [],
        "log_source": None
    }
    
    log_sources = [
        "/var/log/kountryeye/app.log",
        "/var/www/kountryeye/backend/app.log",
    ]
    
    for source in log_sources:
        if os.path.exists(source):
            error_summary["log_source"] = source
            try:
                with open(source, 'r', encoding='utf-8', errors='ignore') as f:
                    lines = f.readlines()[-1000:]  # Last 1000 lines
                
                for line in lines:
                    line = line.strip()
                    if not line:
                        continue
                    
                    is_error = False
                    error_type = "general"
                    
                    if "error" in line.lower():
                        is_error = True
                        if "500" in line:
                            error_type = "500_internal"
                        elif "404" in line:
                            error_type = "404_not_found"
                        elif "422" in line:
                            error_type = "422_validation"
                        elif "database" in line.lower() or "sql" in line.lower():
                            error_type = "database"
                        elif "permission" in line.lower():
                            error_type = "permission"
                    elif "exception" in line.lower() or "traceback" in line.lower():
                        is_error = True
                        error_type = "exception"
                    
                    if is_error:
                        error_summary["total_errors"] += 1
                        error_summary["error_types"][error_type] = error_summary["error_types"].get(error_type, 0) + 1
                        
                        if len(error_summary["recent_errors"]) < 20:
                            error_summary["recent_errors"].append({
                                "type": error_type,
                                "message": line[:500]  # Truncate long messages
                            })
                
                break
            except Exception as e:
                error_summary["error"] = str(e)
    
    return error_summary
