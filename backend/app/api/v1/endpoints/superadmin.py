"""Superadmin-only console APIs. No credentials or payment records can be reverted."""
import json
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, text
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError, OperationalError
from app.api.v1.deps import get_current_superuser
from app.core.database import get_db, Base
from app.models.user import User, Role, Permission
from app.models.branch import Branch
from app.models.change_log import ChangeLog
from app.models.settings import SystemSetting
from app.services.change_history import TRACKED, COLLECTIONS, encode, secret_setting

router = APIRouter(dependencies=[Depends(get_current_superuser)])


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    async def count(model, *filters):
        return (await db.execute(select(func.count()).select_from(model).where(*filters))).scalar_one()
    return {
        "users": await count(User), "active_users": await count(User, User.is_active.is_(True)),
        "branches": await count(Branch, Branch.is_active.is_(True)),
        "changes_today": await count(ChangeLog, ChangeLog.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)),
        "sms_integration_ready": False,
    }


@router.get("/settings")
async def system_settings(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SystemSetting).order_by(SystemSetting.key))).scalars().all()
    return [{"key": s.key, "value": None if secret_setting(s.key) else s.value,
             "secret": secret_setting(s.key), "configured": bool(s.value)} for s in rows]


@router.get("/changes")
async def changes(
    page: int = Query(1, ge=1), per_page: int = Query(25, ge=1, le=100),
    entity_type: str | None = None, db: AsyncSession = Depends(get_db),
):
    query = select(ChangeLog)
    if entity_type:
        query = query.where(ChangeLog.entity_type == entity_type)
    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    rows = (await db.execute(query.order_by(ChangeLog.id.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    reverted = set((await db.execute(select(ChangeLog.reverted_change_id).where(ChangeLog.reverted_change_id.in_([r.id for r in rows])))).scalars())
    users = {u.id: f"{u.first_name} {u.last_name}" for u in (await db.execute(select(User).where(User.id.in_({r.changed_by_id for r in rows})))).scalars()}
    display = await _display_lookup(db, rows)
    # Only the newest change to a field can be reverted; older ones are history only
    latest = {}
    for key in {(r.entity_type, r.entity_id, r.field) for r in rows}:
        latest[key] = (await db.execute(select(func.max(ChangeLog.id)).where(
            ChangeLog.entity_type == key[0], ChangeLog.entity_id == key[1], ChangeLog.field == key[2]))).scalar_one()
    return {"total": total, "items": [{
        "id": r.id, "entity_type": r.entity_type, "entity_id": r.entity_id, "entity_label": r.entity_label, "field": r.field,
        "old_value": json.loads(r.old_value), "new_value": json.loads(r.new_value),
        "old_display": display(r.field, json.loads(r.old_value)), "new_display": display(r.field, json.loads(r.new_value)),
        "changed_by": users.get(r.changed_by_id, f"User {r.changed_by_id}"),
        "ip": r.ip, "user_agent": r.user_agent, "created_at": r.created_at,
        "reverted_change_id": r.reverted_change_id,
        "reversible": r.reversible and r.id not in reverted and latest.get((r.entity_type, r.entity_id, r.field)) == r.id,
        "reverted": r.id in reverted,
    } for r in rows]}


async def _display_lookup(db, rows):
    """Turn ids in change values into names (roles, branches, permissions) for people to read."""
    ids = {"role_id": set(), "branch_id": set(), "additional_branches": set(), "permissions": set(),
           "extra_permissions": set(), "denied_permissions": set()}
    for r in rows:
        if r.field in ids:
            for raw in (r.old_value, r.new_value):
                v = json.loads(raw)
                ids[r.field].update(v if isinstance(v, list) else [v] if isinstance(v, int) else [])
    roles = {x.id: x.name for x in (await db.execute(select(Role).where(Role.id.in_(ids["role_id"])))).scalars()}
    branch_ids = ids["branch_id"] | ids["additional_branches"]
    branches = {x.id: x.name for x in (await db.execute(select(Branch).where(Branch.id.in_(branch_ids))) ).scalars()}
    perm_ids = ids["permissions"] | ids["extra_permissions"] | ids["denied_permissions"]
    perms = {x.id: x.name for x in (await db.execute(select(Permission).where(Permission.id.in_(perm_ids)))).scalars()}

    def show(field, value):
        if value is None or value == "[redacted]":
            return "—" if value is None else "Hidden"
        if isinstance(value, bool):
            return "Yes" if value else "No"
        names = {"role_id": roles, "branch_id": branches, "additional_branches": branches,
                 "permissions": perms, "extra_permissions": perms, "denied_permissions": perms}.get(field)
        if names is not None:
            if isinstance(value, list):
                return ", ".join(sorted(names.get(i, f"#{i}") for i in value)) or "None"
            return names.get(value, f"#{value}")
        return str(value)
    return show


@router.post("/changes/{change_id}/revert")
async def revert(change_id: int, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_superuser)):
    # Acquire a SQLite write reservation before reading, so two requests cannot
    # revert the same snapshot or overwrite an intervening writer.
    try:
        if db.bind.dialect.name == "sqlite":
            await db.execute(text("BEGIN IMMEDIATE"))
        row = await db.get(ChangeLog, change_id)
        if not row:
            raise HTTPException(404, "Change not found")
        if not row.reversible or row.field not in (*TRACKED.get(row.entity_type, ()), *COLLECTIONS.get(row.entity_type, ())):
            raise HTTPException(400, "This change cannot be reverted")
        if (await db.execute(select(ChangeLog.id).where(ChangeLog.reverted_change_id == row.id))).first():
            raise HTTPException(409, "This change was already reverted")
        # A newer change, even to the same value, invalidates the old snapshot.
        newer = await db.execute(select(ChangeLog.id).where(ChangeLog.entity_type == row.entity_type, ChangeLog.entity_id == row.entity_id, ChangeLog.field == row.field, ChangeLog.id > row.id).limit(1))
        if newer.first():
            raise HTTPException(409, "A newer change exists. Revert the latest change first.")
        model = next((m.class_ for m in Base.registry.mappers if m.local_table.name == row.entity_type), None)
        query = select(model).where(model.id == row.entity_id)
        collection = row.field in COLLECTIONS.get(row.entity_type, ())
        if collection:
            query = query.options(selectinload(getattr(model, row.field)))
        obj = (await db.execute(query)).scalar_one_or_none()
        if obj is None:
            raise HTTPException(409, "The record no longer exists")
        if row.entity_type == "system_settings" and secret_setting(obj.key):
            raise HTTPException(400, "Credentials cannot be reverted")
        old, new = json.loads(row.old_value), json.loads(row.new_value)
        current = sorted(x.id for x in getattr(obj, row.field)) if collection else getattr(obj, row.field)
        if encode(current) != encode(new):
            raise HTTPException(409, "The current value differs from this change")
        if row.entity_type == "users":
            if row.field in ("is_active", "is_superuser") and obj.id == current_user.id and old is False:
                raise HTTPException(400, "You cannot remove your own access")
            if row.field in ("role_id", "branch_id") and old is not None:
                if not await db.get(Role if row.field == "role_id" else Branch, old):
                    raise HTTPException(409, "The previous assignment no longer exists")
        if collection:
            related = Branch if row.field == "additional_branches" else Permission
            restored = (await db.execute(select(related).where(related.id.in_(old)))).scalars().all()
            if len(restored) != len(old):
                raise HTTPException(409, "Some previous grants no longer exist")
            setattr(obj, row.field, list(restored))
        else:
            if isinstance(current, Decimal) and old is not None:
                old = Decimal(old)
            setattr(obj, row.field, old)
        if hasattr(obj, "updated_by_id"):
            obj.updated_by_id = current_user.id
        if row.entity_type == "products" and row.field == "unit_price":
            from app.models.sales import PriceHistory
            db.add(PriceHistory(product_id=obj.id, old_price=current, new_price=old, changed_by_id=current_user.id, reason=f"Revert change {row.id}"))
        if row.entity_type == "users" and row.field == "branch_id":
            obj.branch_verification_required = True
        db.info["reverting_change_id"] = row.id
        await db.commit()
    except (IntegrityError, OperationalError):
        await db.rollback()
        raise HTTPException(409, "The change conflicts with the current data; refresh and try again")
    finally:
        db.info.pop("reverting_change_id", None)
    return {"message": "Change reverted"}


# ---------- SMS wallet and billing ----------

from pydantic import BaseModel, Field  # noqa: E402


class TopUpIn(BaseModel):
    amount: Decimal = Field(gt=0, le=100000)
    note: str | None = Field(default=None, max_length=255)


class TestSmsIn(BaseModel):
    phone: str = Field(min_length=9, max_length=20)


@router.get("/sms/summary")
async def sms_summary(month: str | None = None, db: AsyncSession = Depends(get_db)):
    """Credit, Arkesel balance and this month's bill: what Arkesel cost vs what the shop was charged."""
    from app.models.sms import SmsMessage
    from app.services.sms.service import credit_status, get_setting
    from app.services.sms import arkesel
    from app.core.config import settings as app_settings
    now = datetime.utcnow()
    try:
        start = datetime.strptime(month, "%Y-%m") if month else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    except ValueError:
        raise HTTPException(400, "Month must look like 2026-10")
    end = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    # The bill is what the wallet was actually charged: one ledger debit per accepted message.
    # Arkesel charges on acceptance, so a later "failed" delivery report doesn't remove it.
    from app.models.sms import SmsCreditEntry
    rows = (await db.execute(
        select(SmsMessage.category, func.count(), func.coalesce(func.sum(SmsMessage.segments), 0),
               func.coalesce(func.sum(SmsMessage.provider_cost), 0), func.coalesce(func.sum(-SmsCreditEntry.amount), 0))
        .join(SmsCreditEntry, (SmsCreditEntry.message_id == SmsMessage.id) & (SmsCreditEntry.kind == "send"))
        .where(SmsMessage.created_at >= start, SmsMessage.created_at < end).group_by(SmsMessage.category)
    )).all()
    by_category = [{"category": c, "messages": n, "segments": int(seg), "provider_cost": float(pc), "shop_cost": float(sc)} for c, n, seg, pc, sc in rows]
    status_counts = dict((await db.execute(
        select(SmsMessage.status, func.count()).where(SmsMessage.created_at >= start, SmsMessage.created_at < end).group_by(SmsMessage.status)
    )).all())
    provider = sum(r["provider_cost"] for r in by_category)
    shop = sum(r["shop_cost"] for r in by_category)
    api_key = await get_setting(db, "sms.api_key")
    arkesel_balance, arkesel_error = None, None
    if api_key and not app_settings.SMS_DRY_RUN:
        try:
            arkesel_balance = await arkesel.balance(api_key)
        except arkesel.ArkeselError as exc:
            arkesel_error = str(exc)
    return {
        "month": start.strftime("%Y-%m"), "credit": await credit_status(db),
        "dry_run": bool(app_settings.SMS_DRY_RUN or not api_key), "api_key_set": bool(api_key),
        "arkesel_balance": arkesel_balance, "arkesel_error": arkesel_error,
        "messages": sum(r["messages"] for r in by_category), "provider_cost": round(provider, 2),
        "shop_billed": round(shop, 2), "margin": round(shop - provider, 2),
        "by_category": by_category, "by_status": status_counts,
    }


@router.get("/sms/ledger")
async def sms_ledger(page: int = Query(1, ge=1), db: AsyncSession = Depends(get_db)):
    from app.models.sms import SmsCreditEntry
    q = select(SmsCreditEntry).where(SmsCreditEntry.kind != "send")
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.order_by(SmsCreditEntry.id.desc()).offset((page - 1) * 25).limit(25))).scalars().all()
    names = {u.id: f"{u.first_name} {u.last_name}" for u in (await db.execute(select(User).where(User.id.in_({r.created_by_id for r in rows if r.created_by_id})))).scalars()}
    return {"total": total, "items": [{"id": r.id, "kind": r.kind, "amount": float(r.amount), "note": r.note,
                                       "by": names.get(r.created_by_id), "created_at": r.created_at} for r in rows]}


@router.post("/sms/topup")
async def sms_topup(data: TopUpIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_superuser)):
    from app.models.sms import SmsCreditEntry
    from app.services.sms.service import credit_status
    db.add(SmsCreditEntry(kind="topup", amount=data.amount.quantize(Decimal("0.01")), note=(data.note or "Top-up")[:255],
                          created_by_id=current_user.id))
    # Messages held back for lack of credit can go now
    from app.models.sms import SmsMessage
    from sqlalchemy import update
    await db.execute(update(SmsMessage).where(SmsMessage.status == "blocked", SmsMessage.created_at >= datetime.utcnow() - timedelta(days=2)).values(status="queued", error=None))
    await db.commit()
    from app.services.sms.service import kick
    kick()
    return {"message": "Credit added", "credit": await credit_status(db)}


@router.post("/sms/test")
async def sms_test(data: TestSmsIn, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_superuser)):
    from app.services.sms.service import queue_sms, kick
    from app.services.sms.text import normalize_phone
    if not normalize_phone(data.phone):
        raise HTTPException(400, "Enter a valid Ghana phone number")
    msg = await queue_sms(db, data.phone, "Kountry Eyecare: test message. SMS is working.", "manual", sent_by_id=current_user.id)
    await db.commit()
    from app.services.sms.service import dispatch_queued
    await dispatch_queued()
    await db.refresh(msg)
    return {"status": msg.status, "error": msg.error}
