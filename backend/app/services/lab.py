"""Glasses jobs: created when the doctor saves an optical prescription; the lab moves them
received -> in progress -> ready, the front desk marks them collected. Patients get an SMS
when work starts (with the date) and when the glasses are ready; staff get in-app alerts."""
from datetime import datetime, date

from sqlalchemy import select, func

from app.models.lab import LabJob


def _staff_with(perm_codes: set[str]):
    """Query for active users whose role grants any of these permission codes."""
    from app.models.user import User, Role, Permission, RolePermission
    return (select(User).join(Role, Role.id == User.role_id)
            .join(RolePermission, RolePermission.c.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.c.permission_id)
            .where(User.is_active.is_(True), Permission.code.in_(perm_codes)).distinct())


async def notify(db, users, title: str, message: str, job: LabJob) -> None:
    from app.models.communication import Notification
    for u in users:
        db.add(Notification(user_id=u.id, title=title, message=message, notification_type="system",
                            reference_type="lab_job", reference_id=job.id, action_url=f"/lab?job={job.id}"))


async def create_job_for_prescription(db, prescription, visit) -> LabJob:
    """New glasses job in the central lab queue (caller commits)."""
    existing = (await db.execute(select(LabJob).where(LabJob.prescription_id == prescription.id))).scalar_one_or_none()
    if existing:
        return existing
    count = (await db.execute(select(func.count(LabJob.id)))).scalar_one() + 1
    job = LabJob(job_number=f"GL-{date.today():%y%m%d}-{count:04d}", prescription_id=prescription.id,
                 patient_id=prescription.patient_id, visit_id=visit.id if visit else None,
                 pickup_branch_id=visit.branch_id if visit else None, status="received")
    db.add(job)
    await db.flush()
    techs = (await db.execute(_staff_with({"lab.manage"}))).scalars().all()
    await notify(db, techs, "New glasses job", f"Job {job.job_number} is waiting in the lab queue.", job)
    return job


async def _patient_and_branch(db, job):
    from app.models.patient import Patient
    from app.models.branch import Branch
    patient = await db.get(Patient, job.patient_id) if job.patient_id else None
    branch = await db.get(Branch, job.pickup_branch_id) if job.pickup_branch_id else None
    return patient, branch


async def sms_in_progress(db, job) -> None:
    from app.services.sms.service import queue_sms, render
    patient, _ = await _patient_and_branch(db, job)
    if not patient or not job.estimated_ready_date:
        return
    body = await render(db, "in_progress", first_name=patient.first_name, date=job.estimated_ready_date.strftime("%a %d %b"))
    await queue_sms(db, patient.phone, body, "lab", patient=patient, name=f"{patient.first_name} {patient.last_name}",
                    entity_type="lab_job", entity_id=job.id,
                    dedupe_key=f"lab:{job.id}:progress:{job.estimated_ready_date.isoformat()}")


async def sms_ready(db, job) -> None:
    from app.services.sms.service import queue_sms, render
    from app.services.balances import patient_balance
    patient, branch = await _patient_and_branch(db, job)
    if not patient:
        return
    balance = await patient_balance(db, patient.id)
    body = await render(db, "ready", first_name=patient.first_name, branch=branch.name if branch else "the clinic",
                        balance=f"{balance:,.2f}", branch_phone=(branch.phone if branch else "") or "")
    await queue_sms(db, patient.phone, body, "lab", patient=patient, name=f"{patient.first_name} {patient.last_name}",
                    entity_type="lab_job", entity_id=job.id, dedupe_key=f"lab:{job.id}:ready")


async def notify_ready(db, job) -> None:
    """Front desk at the pickup branch (or everyone with front desk access if no branch)."""
    from app.models.user import User
    q = _staff_with({"payments.create", "visits.checkin"})
    if job.pickup_branch_id:
        q = q.where(User.branch_id == job.pickup_branch_id)
    users = (await db.execute(q)).scalars().all()
    patient, _ = await _patient_and_branch(db, job)
    who = f"{patient.first_name} {patient.last_name}" if patient else job.job_number
    await notify(db, users, "Glasses ready for pickup", f"{who}'s glasses ({job.job_number}) are ready.", job)


async def check_overdue(db, now: datetime | None = None) -> int:
    """Alert admins and front desk once about jobs past their estimated date."""
    now = now or datetime.utcnow()
    jobs = (await db.execute(select(LabJob).where(
        LabJob.status.in_(["received", "in_progress"]), LabJob.estimated_ready_date < now.date(),
        LabJob.overdue_notified_at.is_(None),
    ))).scalars().all()
    if not jobs:
        return 0
    users = (await db.execute(_staff_with({"employees.manage", "payments.create"}))).scalars().all()
    for job in jobs:
        await notify(db, users, "Glasses job overdue",
                     f"Job {job.job_number} was due {job.estimated_ready_date:%d %b} and isn't ready yet.", job)
        job.overdue_notified_at = now
    return len(jobs)
