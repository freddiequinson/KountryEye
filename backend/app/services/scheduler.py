"""Background jobs. Runs only where SCHEDULER_ENABLED=1 (production: one uvicorn worker).

Every minute: send queued SMS, start due campaigns, and run the automatic messages
(birthdays, review reminders, optional balance reminders) once a day at their set time.
Every automatic message has a dedupe key, so restarts never send twice. Ghana time = UTC.
"""
import logging
from datetime import date, datetime, timedelta

from sqlalchemy import select, extract

from app.models.settings import SystemSetting

log = logging.getLogger("app.scheduler")
_scheduler = None


async def _setting(db, key, default=None):
    from app.services.sms.service import get_setting
    return await get_setting(db, key, default)


async def _set(db, key, value):
    row = (await db.execute(select(SystemSetting).where(SystemSetting.key == key))).scalar_one_or_none()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=key, value=value, description="Set by the scheduler"))


def _due(now: datetime, hhmm: str | None) -> bool:
    try:
        h, m = (int(x) for x in (hhmm or "08:00").split(":"))
    except ValueError:
        h, m = 8, 0
    return (now.hour, now.minute) >= (h, m)


async def _branch_phone(db, branch_id):
    from app.api.v1.endpoints.sms import branch_phone
    return await branch_phone(db, branch_id)


async def run_birthdays(db, today: date) -> int:
    from app.models.patient import Patient
    from app.models.user import User
    from app.services.sms.service import queue_sms, render
    days = [today.day]
    if today.month == 2 and today.day == 28 and not (today.year % 4 == 0 and (today.year % 100 != 0 or today.year % 400 == 0)):
        days.append(29)  # Feb 29 birthdays get their wish on Feb 28 in other years
    count = 0
    patients = (await db.execute(select(Patient).where(
        extract("month", Patient.date_of_birth) == today.month, extract("day", Patient.date_of_birth).in_(days)
    ))).scalars().all()
    for p in patients:
        body = await render(db, "birthday", first_name=p.first_name)
        if await queue_sms(db, p.phone, body, "birthday", patient=p, name=f"{p.first_name} {p.last_name}",
                           dedupe_key=f"birthday:patient:{p.id}:{today.year}"):
            count += 1
    staff = (await db.execute(select(User).where(
        User.is_active.is_(True), extract("month", User.date_of_birth) == today.month, extract("day", User.date_of_birth).in_(days)
    ))).scalars().all()
    for u in staff:
        body = await render(db, "birthday", first_name=u.first_name)
        if await queue_sms(db, u.phone, body, "birthday", user_id=u.id, name=f"{u.first_name} {u.last_name}",
                           dedupe_key=f"birthday:user:{u.id}:{today.year}"):
            count += 1
    return count


async def run_review_reminders(db, today: date) -> int:
    from app.models.patient import Visit, Patient
    from app.services.sms.service import queue_sms, render
    count = 0
    for offset in (2, 0):  # two days before, and on the day
        target = today + timedelta(days=offset)
        rows = (await db.execute(select(Visit, Patient).join(Patient, Patient.id == Visit.patient_id)
                                 .where(Visit.next_review_date == target))).all()
        for v, p in rows:
            body = await render(db, "review", first_name=p.first_name, date=target.strftime("%a %d %b"),
                                branch_phone=await _branch_phone(db, v.branch_id))
            if await queue_sms(db, p.phone, body, "review", patient=p, name=f"{p.first_name} {p.last_name}",
                               entity_type="visit", entity_id=v.id, dedupe_key=f"review:{v.id}:{target.isoformat()}:{offset}"):
                count += 1
    return count


async def run_debt_reminders(db, today: date) -> int:
    from decimal import Decimal
    from app.models.patient import Patient
    from app.services.balances import all_patient_balances
    from app.services.sms.service import queue_sms, render, get_decimal
    minimum = await get_decimal(db, "sms.automation.debt_minimum", "10")
    balances = await all_patient_balances(db)
    ids = [pid for pid, amt in balances.items() if amt >= max(minimum, Decimal("0.01"))]
    count = 0
    if ids:
        for p in (await db.execute(select(Patient).where(Patient.id.in_(ids)))).scalars().all():
            body = await render(db, "debt", first_name=p.first_name, balance=f"{balances[p.id]:,.2f}",
                                branch_phone=await _branch_phone(db, p.branch_id))
            if await queue_sms(db, p.phone, body, "debt", patient=p, name=f"{p.first_name} {p.last_name}",
                               dedupe_key=f"debt:{p.id}:{today.isoformat()}"):
                count += 1
    return count


async def tick(now: datetime | None = None) -> dict:
    """One scheduler pass. Safe to call any time (tests call it directly)."""
    from app.core.database import async_session_maker
    from app.models.sms import SmsCampaign
    from app.api.v1.endpoints.sms import run_campaign
    from app.services.sms.service import dispatch_queued
    now = now or datetime.utcnow()
    today = now.date()
    report = {}
    async with async_session_maker() as db:
        # Scheduled campaigns that are due
        due = (await db.execute(select(SmsCampaign).where(SmsCampaign.status == "scheduled", SmsCampaign.scheduled_at <= now))).scalars().all()
        for c in due:
            c.status = "sending"
            await run_campaign(db, c)
        report["campaigns"] = len(due)

        jobs = [
            ("birthday", "sms.automation.birthday_enabled", "sms.automation.birthday_time", run_birthdays),
            ("review", "sms.automation.review_enabled", "sms.automation.review_time", run_review_reminders),
        ]
        for name, enabled_key, time_key, job in jobs:
            last_key = f"sms.automation.{name}_last_run"
            if (await _setting(db, enabled_key, "false")) == "true" and _due(now, await _setting(db, time_key, "08:00")) \
                    and (await _setting(db, last_key)) != today.isoformat():
                report[name] = await job(db, today)
                await _set(db, last_key, today.isoformat())

        freq = await _setting(db, "sms.automation.debt_frequency", "off")
        interval = {"weekly": 7, "fortnightly": 14, "monthly": 30}.get(freq)
        if interval and _due(now, await _setting(db, "sms.automation.debt_time", "09:00")):
            last = await _setting(db, "sms.automation.debt_last_run")
            if not last or date.fromisoformat(last) <= today - timedelta(days=interval):
                report["debt"] = await run_debt_reminders(db, today)
                await _set(db, "sms.automation.debt_last_run", today.isoformat())

        try:
            from app.services.lab import check_overdue  # Phase 5
            report["lab_overdue"] = await check_overdue(db, now)
        except ImportError:
            pass
        await db.commit()
    report["sent"] = await dispatch_queued()
    return report


async def _safe_tick():
    try:
        report = await tick()
        if any(report.values()):
            log.info("Scheduler: %s", report)
    except Exception:
        log.exception("Scheduler tick failed")


def start() -> None:
    global _scheduler
    from apscheduler.schedulers.asyncio import AsyncIOScheduler
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(_safe_tick, "interval", minutes=1, id="tick", max_instances=1, coalesce=True)
    _scheduler.start()
    log.warning("Scheduler started")


def stop() -> None:
    if _scheduler:
        _scheduler.shutdown(wait=False)
