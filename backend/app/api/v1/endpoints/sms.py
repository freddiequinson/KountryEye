"""SMS for clinic staff: log, single messages, previews with cost, campaigns, groups, debtors."""
import json
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import require_permission, has_permission
from app.core.database import get_db
from app.models.user import User
from app.models.patient import Patient, Visit
from app.models.sms import SmsMessage, SmsCampaign, ContactGroup, ContactGroupMember
from app.services.sms.service import queue_sms, kick, credit_status, get_decimal, render
from app.services.sms.text import sms_info, normalize_phone
from app.services.sms.audience import resolve_audience

router = APIRouter()

ANY_SMS = require_permission("sms.view", "sms.send", "sms.bulk_send", "debtors.view")
VIEW = require_permission("sms.view")
SEND = require_permission("sms.send")
BULK = require_permission("sms.bulk_send")
DEBTORS = require_permission("debtors.view")

MAX_LEN = 918  # 6 segments; longer promos get expensive fast


class SendIn(BaseModel):
    message: str = Field(min_length=1, max_length=MAX_LEN)
    patient_id: Optional[int] = None
    phone: Optional[str] = None


class PreviewIn(BaseModel):
    message: str = Field(default="", max_length=MAX_LEN)
    audience: dict = {}


class CampaignIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=MAX_LEN)
    audience: dict
    scheduled_at: Optional[datetime] = None  # Ghana time = UTC; empty = send now


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = Field(default=None, max_length=255)


class MembersIn(BaseModel):
    patient_ids: list[int] = []
    numbers: str = ""


class RemindIn(BaseModel):
    patient_ids: list[int] = Field(min_length=1, max_length=2000)
    message: Optional[str] = Field(default=None, max_length=MAX_LEN)


def _cost(info: dict, rate: Decimal, recipients: int) -> float:
    return float((rate * info["segments"] * recipients).quantize(Decimal("0.01")))


def campaign_body(message: str, recipient: dict) -> str:
    """The text a recipient actually gets (placeholders filled)."""
    p = recipient.get("patient")
    return message.replace("{first_name}", p.first_name if p else "").strip()


def audience_segments(message: str, recipients: list[dict]) -> int:
    """Total segments across all recipients, after their placeholders are filled."""
    return sum(sms_info(campaign_body(message, r))["segments"] for r in recipients)


@router.get("/credit")
async def get_credit(db: AsyncSession = Depends(get_db), user: User = Depends(ANY_SMS)):
    return await credit_status(db)


@router.get("/messages")
async def list_messages(
    page: int = Query(1, ge=1), per_page: int = Query(25, ge=1, le=100),
    category: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None,
    db: AsyncSession = Depends(get_db), user: User = Depends(VIEW),
):
    q = select(SmsMessage)
    if category:
        q = q.where(SmsMessage.category == category)
    if status:
        q = q.where(SmsMessage.status == status)
    if search:
        term = f"%{search.strip()[:50]}%"
        q = q.where(SmsMessage.recipient.ilike(term) | SmsMessage.recipient_name.ilike(term))
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar_one()
    rows = (await db.execute(q.order_by(SmsMessage.id.desc()).offset((page - 1) * per_page).limit(per_page))).scalars().all()
    return {"total": total, "items": [{
        "id": m.id, "recipient": m.recipient, "recipient_name": m.recipient_name, "patient_id": m.patient_id,
        "body": m.body, "category": m.category, "status": m.status, "segments": m.segments,
        "cost": float(m.shop_cost or 0), "error": m.error, "created_at": m.created_at, "sent_at": m.sent_at,
        "delivered_at": m.delivered_at,
    } for m in rows]}


@router.post("/send")
async def send_one(data: SendIn, db: AsyncSession = Depends(get_db), user: User = Depends(SEND)):
    patient = await db.get(Patient, data.patient_id) if data.patient_id else None
    phone = patient.phone if patient else data.phone
    if not normalize_phone(phone):
        raise HTTPException(400, "Enter a valid Ghana phone number")
    if not (await credit_status(db))["can_send"]:
        raise HTTPException(402, "Shop SMS credit is used up. Ask the superadmin to top up.")
    msg = await queue_sms(db, phone, data.message.strip(), "manual", patient=patient,
                          name=f"{patient.first_name} {patient.last_name}" if patient else None, sent_by_id=user.id)
    await db.commit()
    kick()
    return {"message": "SMS queued", "id": msg.id}


@router.post("/preview")
async def preview(data: PreviewIn, db: AsyncSession = Depends(get_db), user: User = Depends(require_permission("sms.send", "sms.bulk_send", "debtors.view"))):
    info = sms_info(data.message)
    rate = await get_decimal(db, "sms.shop_rate", "0")
    credit = await credit_status(db)
    result = {"recipients": 0, "skipped_opt_out": 0, "skipped_no_phone": 0, "sample": []}
    if data.audience:
        if data.audience.get("type") != "patients" and not has_permission(user, "sms.bulk_send"):
            raise HTTPException(403, "You don't have permission to send bulk SMS")
        aud = await resolve_audience(db, data.audience)
        result = {"recipients": len(aud["recipients"]), "skipped_opt_out": aud["skipped_opt_out"],
                  "skipped_no_phone": aud["skipped_no_phone"],
                  "sample": [r["name"] or r["phone"] for r in aud["recipients"][:5]]}
    if data.audience:
        segments = audience_segments(data.message, aud["recipients"])
        result["total_segments"] = segments
        cost = float((rate * segments).quantize(Decimal("0.01")))
    else:
        cost = _cost(info, rate, 1)
    after = credit["balance"] - cost
    return {**info, **result, "cost": cost, "shop_rate": float(rate), "credit": credit["balance"],
            "credit_after": round(after, 2), "within_credit": after >= -credit["overdraft_limit"]}


async def run_campaign(db, campaign: SmsCampaign) -> None:
    """Queue every recipient of a campaign (caller commits and kicks)."""
    aud = await resolve_audience(db, json.loads(campaign.audience))
    rate = await get_decimal(db, "sms.shop_rate", "0")
    queued = segments = 0
    for r in aud["recipients"]:
        p = r["patient"]
        msg = await queue_sms(db, r["phone"], campaign_body(campaign.message, r), "promo", name=r["name"], patient=p,
                              campaign_id=campaign.id, sent_by_id=campaign.created_by_id,
                              dedupe_key=f"campaign:{campaign.id}:{r['phone']}")
        if msg:
            queued += 1
            segments += msg.segments
    campaign.recipients = queued
    campaign.shop_cost = rate * segments
    campaign.status = "sent"
    campaign.finished_at = datetime.utcnow()


@router.get("/campaigns")
async def list_campaigns(db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    rows = (await db.execute(select(SmsCampaign).order_by(SmsCampaign.id.desc()).limit(100))).scalars().all()
    counts = {}
    if rows:
        for cid, status, n in (await db.execute(
            select(SmsMessage.campaign_id, SmsMessage.status, func.count()).where(SmsMessage.campaign_id.in_([c.id for c in rows]))
            .group_by(SmsMessage.campaign_id, SmsMessage.status)
        )).all():
            counts.setdefault(cid, {})[status] = n
    return [{
        "id": c.id, "name": c.name, "message": c.message, "audience": json.loads(c.audience), "status": c.status,
        "scheduled_at": c.scheduled_at, "recipients": c.recipients, "cost": float(c.shop_cost or 0),
        "created_at": c.created_at, "finished_at": c.finished_at, "delivery": counts.get(c.id, {}),
    } for c in rows]


@router.post("/campaigns")
async def create_campaign(data: CampaignIn, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    credit = await credit_status(db)
    if not credit["can_send"]:
        raise HTTPException(402, "Shop SMS credit is used up. Ask the superadmin to top up.")
    aud = await resolve_audience(db, data.audience)
    if not aud["recipients"]:
        raise HTTPException(400, "Nobody matches this audience")
    rate = await get_decimal(db, "sms.shop_rate", "0")
    cost = float((rate * audience_segments(data.message, aud["recipients"])).quantize(Decimal("0.01")))
    if credit["balance"] - cost < -credit["overdraft_limit"]:
        raise HTTPException(402, f"Not enough SMS credit: this costs GHS {cost:.2f}, credit is GHS {credit['balance']:.2f}")
    later = data.scheduled_at and data.scheduled_at.replace(tzinfo=None) > datetime.utcnow() + timedelta(minutes=1)
    campaign = SmsCampaign(name=data.name.strip(), message=data.message.strip(), audience=json.dumps(data.audience),
                           status="scheduled" if later else "sending",
                           scheduled_at=data.scheduled_at.replace(tzinfo=None) if later else None,
                           recipients=len(aud["recipients"]), created_by_id=user.id)
    db.add(campaign)
    await db.flush()
    if not later:
        await run_campaign(db, campaign)
    await db.commit()
    kick()
    return {"id": campaign.id, "status": campaign.status, "recipients": campaign.recipients}


@router.post("/campaigns/{campaign_id}/cancel")
async def cancel_campaign(campaign_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    c = await db.get(SmsCampaign, campaign_id)
    if not c:
        raise HTTPException(404, "Campaign not found")
    if c.status != "scheduled":
        raise HTTPException(400, "Only scheduled campaigns can be cancelled")
    c.status = "cancelled"
    await db.commit()
    return {"message": "Campaign cancelled"}


# ---------- contact groups ----------

@router.get("/groups")
async def list_groups(db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    rows = (await db.execute(
        select(ContactGroup, func.count(ContactGroupMember.id)).outerjoin(ContactGroupMember, ContactGroupMember.group_id == ContactGroup.id)
        .group_by(ContactGroup.id).order_by(ContactGroup.name)
    )).all()
    return [{"id": g.id, "name": g.name, "description": g.description, "members": n} for g, n in rows]


@router.post("/groups")
async def create_group(data: GroupIn, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    if (await db.execute(select(ContactGroup.id).where(func.lower(ContactGroup.name) == data.name.strip().lower()))).first():
        raise HTTPException(400, "A group with this name already exists")
    g = ContactGroup(name=data.name.strip(), description=data.description, created_by_id=user.id)
    db.add(g)
    await db.commit()
    return {"id": g.id, "name": g.name}


@router.get("/groups/{group_id}")
async def get_group(group_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    g = await db.get(ContactGroup, group_id)
    if not g:
        raise HTTPException(404, "Group not found")
    members = (await db.execute(select(ContactGroupMember).where(ContactGroupMember.group_id == group_id).order_by(ContactGroupMember.name))).scalars().all()
    return {"id": g.id, "name": g.name, "description": g.description,
            "members": [{"id": m.id, "name": m.name, "phone": m.phone, "patient_id": m.patient_id} for m in members]}


@router.post("/groups/{group_id}/members")
async def add_members(group_id: int, data: MembersIn, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    if not await db.get(ContactGroup, group_id):
        raise HTTPException(404, "Group not found")
    have = set((await db.execute(select(ContactGroupMember.phone).where(ContactGroupMember.group_id == group_id))).scalars().all())
    added, invalid = 0, 0
    if data.patient_ids:
        for p in (await db.execute(select(Patient).where(Patient.id.in_(data.patient_ids[:5000])))).scalars().all():
            number = normalize_phone(p.phone)
            if number and number not in have:
                db.add(ContactGroupMember(group_id=group_id, patient_id=p.id, phone=number, name=f"{p.first_name} {p.last_name}"))
                have.add(number)
                added += 1
    import re
    for raw in re.split(r"[\n,;]+", data.numbers or ""):
        raw = raw.strip()
        if not raw:
            continue
        # "Name, 024xxxxxxx" lines from a CSV: take the last number-looking part
        parts = [x.strip() for x in re.split(r"\t|\s{2,}", raw) if x.strip()]
        number = normalize_phone(parts[-1] if parts else raw)
        name = " ".join(parts[:-1]) or None
        if not number:
            invalid += 1
        elif number not in have:
            db.add(ContactGroupMember(group_id=group_id, phone=number, name=name))
            have.add(number)
            added += 1
    await db.commit()
    return {"added": added, "invalid": invalid}


@router.delete("/groups/{group_id}/members/{member_id}")
async def remove_member(group_id: int, member_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    await db.execute(delete(ContactGroupMember).where(ContactGroupMember.id == member_id, ContactGroupMember.group_id == group_id))
    await db.commit()
    return {"message": "Removed"}


@router.delete("/groups/{group_id}")
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(BULK)):
    await db.execute(delete(ContactGroupMember).where(ContactGroupMember.group_id == group_id))
    await db.execute(delete(ContactGroup).where(ContactGroup.id == group_id))
    await db.commit()
    return {"message": "Group deleted"}


# ---------- debtors ----------

@router.get("/debtors")
async def debtors(min_balance: float = 0, db: AsyncSession = Depends(get_db), user: User = Depends(DEBTORS)):
    from app.services.balances import all_patient_balances
    balances = await all_patient_balances(db)
    ids = [pid for pid, amt in balances.items() if amt >= Decimal(str(min_balance))]
    if not ids:
        return []
    patients = {p.id: p for p in (await db.execute(select(Patient).where(Patient.id.in_(ids)))).scalars().all()}
    last_visit = dict((await db.execute(select(Visit.patient_id, func.max(Visit.visit_date)).where(Visit.patient_id.in_(ids)).group_by(Visit.patient_id))).all())
    last_reminder = dict((await db.execute(select(SmsMessage.patient_id, func.max(SmsMessage.created_at))
                                           .where(SmsMessage.patient_id.in_(ids), SmsMessage.category == "debt").group_by(SmsMessage.patient_id))).all())
    rows = []
    for pid in ids:
        p = patients.get(pid)
        if not p:
            continue
        rows.append({"patient_id": pid, "name": f"{p.first_name} {p.last_name}", "patient_number": p.patient_number,
                     "phone": p.phone, "has_valid_phone": bool(normalize_phone(p.phone)), "balance": float(balances[pid]),
                     "last_visit": last_visit.get(pid), "last_reminder": last_reminder.get(pid)})
    rows.sort(key=lambda r: r["balance"], reverse=True)
    return rows


async def branch_phone(db, branch_id) -> str:
    from app.models.branch import Branch
    b = await db.get(Branch, branch_id) if branch_id else None
    if not b:
        b = (await db.execute(select(Branch).where(Branch.is_main.is_(True)))).scalars().first()
    return (b.phone if b else "") or ""


@router.post("/debtors/remind")
async def remind_debtors(data: RemindIn, db: AsyncSession = Depends(get_db), user: User = Depends(DEBTORS)):
    if not has_permission(user, "sms.send", "sms.bulk_send"):
        raise HTTPException(403, "You don't have permission to send SMS")
    if not (await credit_status(db))["can_send"]:
        raise HTTPException(402, "Shop SMS credit is used up. Ask the superadmin to top up.")
    from app.services.balances import patient_balance
    queued, skipped = 0, 0
    today = date.today().isoformat()
    for p in (await db.execute(select(Patient).where(Patient.id.in_(data.patient_ids)))).scalars().all():
        bal = await patient_balance(db, p.id)
        if bal <= 0:
            skipped += 1
            continue
        values = dict(first_name=p.first_name, balance=f"{bal:,.2f}", branch_phone=await branch_phone(db, p.branch_id))
        if data.message:
            from app.services.sms.text import fill
            body = fill(data.message, **values)
        else:
            body = await render(db, "debt", **values)
        msg = await queue_sms(db, p.phone, body, "debt", patient=p, name=f"{p.first_name} {p.last_name}",
                              sent_by_id=user.id, dedupe_key=f"debt:{p.id}:{today}")
        if msg and msg.status == "queued":
            queued += 1
        else:
            skipped += 1
    await db.commit()
    kick()
    return {"queued": queued, "skipped": skipped}
