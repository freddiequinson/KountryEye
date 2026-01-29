from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, case
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, date, timedelta
from app.core.database import get_db
from app.core.security import get_password_hash
from app.api.v1.deps import get_current_active_user
from app.models.user import User, Role
from app.models.branch import Branch
from app.models.employee import Attendance, ActivityLog, Task, EmployeeStats
from app.models.sales import Sale
from app.models.patient import Visit
from app.models.clinical import Consultation, Prescription
from app.schemas.employee import (
    AttendanceResponse, AttendanceClockIn, AttendanceClockOut,
    TaskCreate, TaskUpdate, TaskResponse,
    ActivityLogCreate, ActivityLogResponse,
    EmployeeCreate, EmployeeResponse, EmployeeStatsResponse
)

router = APIRouter()


def generate_password(first_name: str) -> str:
    """Generate a simple password from first name"""
    return f"{first_name.lower()}123"


# Employee CRUD
@router.get("", response_model=List[EmployeeResponse])
async def get_employees(
    branch_id: Optional[int] = None,
    role_id: Optional[int] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all employees"""
    query = select(User).options(
        selectinload(User.role),
        selectinload(User.branch)
    )
    
    if active_only:
        query = query.where(User.is_active == True)
    if branch_id:
        query = query.where(User.branch_id == branch_id)
    if role_id:
        query = query.where(User.role_id == role_id)
    
    query = query.order_by(User.first_name)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=EmployeeResponse)
async def create_employee(
    employee_in: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new employee with auto-generated password"""
    try:
        # Check if email exists
        existing = await db.execute(select(User).where(User.email == employee_in.email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Verify role exists
        role_check = await db.execute(select(Role).where(Role.id == employee_in.role_id))
        if not role_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Role with id {employee_in.role_id} not found")
        
        # Verify branch exists
        branch_check = await db.execute(select(Branch).where(Branch.id == employee_in.branch_id))
        if not branch_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Branch with id {employee_in.branch_id} not found")
        
        # Generate password from first name
        password = generate_password(employee_in.first_name)
        hashed_password = get_password_hash(password)
        
        employee = User(
            email=employee_in.email,
            hashed_password=hashed_password,
            first_name=employee_in.first_name,
            last_name=employee_in.last_name,
            phone=employee_in.phone,
            role_id=employee_in.role_id,
            branch_id=employee_in.branch_id,
            is_active=True
        )
        
        db.add(employee)
        await db.commit()
        await db.refresh(employee)
        
        # Load relationships to avoid async lazy loading issues
        result = await db.execute(
            select(User)
            .options(
                selectinload(User.role),
                selectinload(User.branch)
            )
            .where(User.id == employee.id)
        )
        employee = result.scalar_one()
        
        # Return employee with temporary password info
        response = EmployeeResponse.model_validate(employee)
        # Add password to response (not in schema, but useful for first-time setup)
        print(f"Created employee {employee.email} with password: {password}")
        return response
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        print(f"Error creating employee: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create employee: {str(e)}")


# ============================================
# STATIC ROUTES - Must be before /{employee_id}
# ============================================

# Get roles for dropdown
@router.get("/roles/list")
async def get_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all roles"""
    result = await db.execute(select(Role).order_by(Role.name))
    roles = result.scalars().all()
    return [{"id": r.id, "name": r.name} for r in roles]


# Attendance endpoints
@router.get("/attendance/today", response_model=List[AttendanceResponse])
async def get_today_attendance(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get today's attendance for all employees"""
    today = date.today()
    query = select(Attendance).options(
        selectinload(Attendance.user)
    ).where(Attendance.date == today)
    
    if branch_id:
        query = query.join(User).where(User.branch_id == branch_id)
    
    result = await db.execute(query)
    return result.scalars().all()


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two points in meters using Haversine formula"""
    import math
    R = 6371000  # Earth's radius in meters
    
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi/2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    
    return R * c


def determine_attendance_status(clock_in_time: datetime, work_start_time, late_threshold_minutes: int) -> str:
    """Determine if employee is present or late based on clock-in time"""
    if work_start_time:
        scheduled_start = datetime.combine(clock_in_time.date(), work_start_time)
        late_cutoff = scheduled_start + timedelta(minutes=late_threshold_minutes)
        if clock_in_time > late_cutoff:
            return "late"
    return "present"


@router.post("/attendance/clock-in", response_model=AttendanceResponse)
async def clock_in(
    data: AttendanceClockIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Clock in for the current user with optional geolocation validation"""
    today = date.today()
    now = datetime.now()
    
    existing = await db.execute(
        select(Attendance).where(
            and_(Attendance.user_id == current_user.id, Attendance.date == today)
        )
    )
    attendance = existing.scalar_one_or_none()
    
    if attendance and attendance.clock_in:
        raise HTTPException(status_code=400, detail="Already clocked in today")
    
    # Get branch settings for geolocation validation
    branch = None
    within_geofence = True
    status = "present"
    
    if current_user.branch_id:
        branch_result = await db.execute(select(Branch).where(Branch.id == current_user.branch_id))
        branch = branch_result.scalar_one_or_none()
        
        if branch:
            # Check geolocation if required
            if branch.require_geolocation:
                if not data.latitude or not data.longitude:
                    raise HTTPException(status_code=400, detail="Location is required for clock-in at this branch")
                
                if branch.latitude and branch.longitude:
                    distance = calculate_distance(
                        data.latitude, data.longitude,
                        branch.latitude, branch.longitude
                    )
                    within_geofence = distance <= branch.geofence_radius
            
            # Determine if late
            status = determine_attendance_status(now, branch.work_start_time, branch.late_threshold_minutes)
    
    if not attendance:
        attendance = Attendance(
            user_id=current_user.id,
            branch_id=current_user.branch_id,
            date=today,
            clock_in=now,
            status=status,
            notes=data.notes,
            clock_in_latitude=data.latitude,
            clock_in_longitude=data.longitude,
            clock_in_within_geofence=within_geofence
        )
        db.add(attendance)
    else:
        attendance.clock_in = now
        attendance.status = status
        attendance.notes = data.notes
        attendance.clock_in_latitude = data.latitude
        attendance.clock_in_longitude = data.longitude
        attendance.clock_in_within_geofence = within_geofence
    
    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.post("/attendance/clock-out", response_model=AttendanceResponse)
async def clock_out(
    data: AttendanceClockOut,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Clock out for the current user with optional geolocation validation"""
    today = date.today()
    
    result = await db.execute(
        select(Attendance).where(
            and_(Attendance.user_id == current_user.id, Attendance.date == today)
        )
    )
    attendance = result.scalar_one_or_none()
    
    if not attendance or not attendance.clock_in:
        raise HTTPException(status_code=400, detail="Not clocked in today")
    
    if attendance.clock_out:
        raise HTTPException(status_code=400, detail="Already clocked out today")
    
    # Get branch settings for geolocation validation
    within_geofence = True
    
    if current_user.branch_id:
        branch_result = await db.execute(select(Branch).where(Branch.id == current_user.branch_id))
        branch = branch_result.scalar_one_or_none()
        
        if branch and branch.require_geolocation:
            if not data.latitude or not data.longitude:
                raise HTTPException(status_code=400, detail="Location is required for clock-out at this branch")
            
            if branch.latitude and branch.longitude:
                distance = calculate_distance(
                    data.latitude, data.longitude,
                    branch.latitude, branch.longitude
                )
                within_geofence = distance <= branch.geofence_radius
    
    attendance.clock_out = datetime.now()
    attendance.clock_out_latitude = data.latitude
    attendance.clock_out_longitude = data.longitude
    attendance.clock_out_within_geofence = within_geofence
    
    if data.notes:
        attendance.notes = (attendance.notes or "") + f" | Clock out: {data.notes}"
    
    await db.commit()
    await db.refresh(attendance)
    return attendance


@router.get("/attendance/my-status", response_model=Optional[AttendanceResponse])
async def get_my_attendance_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's attendance status for today"""
    today = date.today()
    result = await db.execute(
        select(Attendance).where(
            and_(Attendance.user_id == current_user.id, Attendance.date == today)
        )
    )
    return result.scalar_one_or_none()


# Task endpoints
@router.get("/tasks", response_model=List[TaskResponse])
async def get_tasks(
    assigned_to_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all tasks"""
    query = select(Task).options(
        selectinload(Task.assigned_to),
        selectinload(Task.assigned_by)
    )
    
    if assigned_to_id:
        query = query.where(Task.assigned_to_id == assigned_to_id)
    if status:
        query = query.where(Task.status == status)
    
    query = query.order_by(Task.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/tasks", response_model=TaskResponse)
async def create_task(
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new task"""
    task = Task(
        **task_in.model_dump(),
        assigned_by_id=current_user.id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update a task"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    for field, value in task_in.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    
    if task_in.status == "completed" and not task.completed_at:
        task.completed_at = datetime.now()
    
    await db.commit()
    await db.refresh(task)
    return task


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a task"""
    result = await db.execute(select(Task).where(Task.id == task_id))
    task = result.scalar_one_or_none()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.delete(task)
    await db.commit()
    return {"message": "Task deleted"}


# Activity Log endpoint
@router.post("/activity", response_model=ActivityLogResponse)
async def log_activity(
    activity_in: ActivityLogCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Log user activity"""
    activity = ActivityLog(
        user_id=current_user.id,
        action=activity_in.action,
        module=activity_in.module,
        description=activity_in.description,
        extra_data=activity_in.extra_data,
        page_path=activity_in.page_path,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent", "")[:500]
    )
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return activity


# ============================================
# DYNAMIC ROUTES - /{employee_id} patterns
# ============================================

@router.get("/{employee_id}", response_model=EmployeeResponse)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get a single employee"""
    result = await db.execute(
        select(User).options(
            selectinload(User.role),
            selectinload(User.branch)
        ).where(User.id == employee_id)
    )
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.put("/{employee_id}", response_model=EmployeeResponse)
async def update_employee(
    employee_id: int,
    employee_in: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Update an employee"""
    result = await db.execute(select(User).where(User.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    employee.first_name = employee_in.first_name
    employee.last_name = employee_in.last_name
    employee.phone = employee_in.phone
    employee.role_id = employee_in.role_id
    employee.branch_id = employee_in.branch_id
    
    await db.commit()
    await db.refresh(employee)
    return employee


@router.delete("/{employee_id}")
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete an employee permanently"""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only superusers can delete employees")
    
    result = await db.execute(select(User).where(User.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    await db.delete(employee)
    await db.commit()
    return {"message": "Employee deleted successfully"}


@router.post("/{employee_id}/reset-password")
async def reset_employee_password(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Reset employee password to default (first_name + 123)"""
    result = await db.execute(select(User).where(User.id == employee_id))
    employee = result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    password = generate_password(employee.first_name)
    employee.hashed_password = pwd_context.hash(password)
    await db.commit()
    
    return {"message": f"Password reset to: {password}"}


@router.get("/{employee_id}/attendance", response_model=List[AttendanceResponse])
async def get_employee_attendance(
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get attendance history for an employee"""
    query = select(Attendance).where(Attendance.user_id == employee_id)
    
    if start_date:
        query = query.where(Attendance.date >= start_date)
    if end_date:
        query = query.where(Attendance.date <= end_date)
    
    query = query.order_by(Attendance.date.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{employee_id}/activity", response_model=List[ActivityLogResponse])
async def get_employee_activity(
    employee_id: int,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get activity logs for an employee"""
    result = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.user_id == employee_id)
        .order_by(ActivityLog.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{employee_id}/stats")
async def get_employee_stats(
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get aggregated stats for an employee"""
    if not start_date:
        start_date = date.today() - timedelta(days=30)
    if not end_date:
        end_date = date.today()
    
    # Get sales count and amount
    sales_result = await db.execute(
        select(
            func.count(Sale.id).label("count"),
            func.coalesce(func.sum(Sale.total_amount), 0).label("amount")
        ).where(
            and_(
                Sale.cashier_id == employee_id,
                func.date(Sale.created_at) >= start_date,
                func.date(Sale.created_at) <= end_date
            )
        )
    )
    sales_data = sales_result.first()
    
    # Get visits added
    visits_result = await db.execute(
        select(func.count(Visit.id)).where(
            and_(
                Visit.recorded_by_id == employee_id,
                func.date(Visit.created_at) >= start_date,
                func.date(Visit.created_at) <= end_date
            )
        )
    )
    visits_count = visits_result.scalar() or 0
    
    # Get consultations
    consult_result = await db.execute(
        select(func.count(Consultation.id)).where(
            and_(
                Consultation.doctor_id == employee_id,
                func.date(Consultation.created_at) >= start_date,
                func.date(Consultation.created_at) <= end_date
            )
        )
    )
    consultations_count = consult_result.scalar() or 0
    
    # Get prescriptions
    rx_result = await db.execute(
        select(func.count(Prescription.id)).where(
            and_(
                Prescription.prescribed_by_id == employee_id,
                func.date(Prescription.created_at) >= start_date,
                func.date(Prescription.created_at) <= end_date
            )
        )
    )
    prescriptions_count = rx_result.scalar() or 0
    
    # Get activity count
    activity_result = await db.execute(
        select(func.count(ActivityLog.id)).where(
            and_(
                ActivityLog.user_id == employee_id,
                func.date(ActivityLog.created_at) >= start_date,
                func.date(ActivityLog.created_at) <= end_date
            )
        )
    )
    activity_count = activity_result.scalar() or 0
    
    # Get attendance summary - use separate counts for simplicity
    base_filter = and_(
        Attendance.user_id == employee_id,
        Attendance.date >= start_date,
        Attendance.date <= end_date
    )
    
    total_result = await db.execute(select(func.count(Attendance.id)).where(base_filter))
    total_days = total_result.scalar() or 0
    
    present_result = await db.execute(
        select(func.count(Attendance.id)).where(and_(base_filter, Attendance.status == "present"))
    )
    present_days = present_result.scalar() or 0
    
    late_result = await db.execute(
        select(func.count(Attendance.id)).where(and_(base_filter, Attendance.status == "late"))
    )
    late_days = late_result.scalar() or 0
    
    absent_result = await db.execute(
        select(func.count(Attendance.id)).where(and_(base_filter, Attendance.status == "absent"))
    )
    absent_days = absent_result.scalar() or 0
    
    return {
        "employee_id": employee_id,
        "period": {"start": start_date.isoformat(), "end": end_date.isoformat()},
        "sales": {
            "count": sales_data.count if sales_data else 0,
            "amount": float(sales_data.amount) if sales_data else 0
        },
        "visits_added": visits_count,
        "consultations": consultations_count,
        "prescriptions": prescriptions_count,
        "activity_count": activity_count,
        "attendance": {
            "total_days": total_days,
            "present_days": present_days,
            "late_days": late_days,
            "absent_days": absent_days
        }
    }
