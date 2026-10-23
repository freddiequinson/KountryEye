"""Queue, price, send and log SMS.

Messages are written as `queued` inside the caller's transaction (so a payment and its
receipt SMS commit together), then sent in the background by `dispatch_queued()`.
Nothing here ever blocks a payment on the SMS provider.
"""
import asyncio
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select, func

from app.core.config import settings as app_settings
from app.models.settings import SystemSetting
from app.models.sms import SmsMessage, SmsCreditEntry
from app.services.sms import arkesel
from app.services.sms.text import normalize_phone, sms_info, fill

log = logging.getLogger("app.sms")

DEFAULT_TEMPLATES = {
    "receipt": "Kountry Eyecare: Paid GHS {amount} (VAT {vat}). Bal GHS {balance}. Receipt: {link}",
    "in_progress": "Kountry Eyecare: Your glasses will be ready by {date}. We'll text you when they're in.",
    "ready": "Kountry Eyecare: Your glasses are ready. Pick up at {branch}. Bal GHS {balance}.",
    "birthday": "Happy birthday {first_name}! From all of us at Kountry Eyecare.",
    "review": "Kountry Eyecare: Your eye review is due on {date}. Call {branch_phone} to book.",
    "debt": "Kountry Eyecare: You have an outstanding balance of GHS {balance}. Please call {branch_phone}.",
}
# Categories a patient can opt out of
PROMO_CATEGORIES = {"promo", "birthday"}


async def get_setting(db, key: str, default=None):
    value = (await db.execute(select(SystemSetting.value).where(SystemSetting.key == key))).scalar_one_or_none()
    return default if value in (None, "") else value


async def get_decimal(db, key: str, default: str = "0") -> Decimal:
    try:
        return Decimal(str(await get_setting(db, key, default)))
    except Exception:
        return Decimal(default)


async def render(db, template_key: str, **values) -> str:
    template = await get_setting(db, f"sms.template.{template_key}", DEFAULT_TEMPLATES.get(template_key, ""))
    return fill(template, **values)


async def credit_balance(db) -> Decimal:
    total = (await db.execute(select(func.coalesce(func.sum(SmsCreditEntry.amount), 0)))).scalar_one()
    return Decimal(str(total)).quantize(Decimal("0.0001"))


async def credit_status(db) -> dict:
    balance = await credit_balance(db)
    overdraft = await get_decimal(db, "sms.credit_overdraft", "20")
    rate = await get_decimal(db, "sms.shop_rate", "0")
    low_at = await get_decimal(db, "sms.credit_low_warning", "10")
    return {
        "balance": float(balance),
        "overdraft_limit": float(overdraft),
        "shop_rate": float(rate),
        "can_send": balance > -overdraft,
        "low": balance <= low_at,
        "messages_left": int((balance + overdraft) / rate) if rate > 0 else None,
    }


async def queue_sms(db, phone, body: str, category: str, *, name: str | None = None, patient=None, user_id: int | None = None,
                    entity_type: str | None = None, entity_id: int | None = None, campaign_id: int | None = None,
                    sent_by_id: int | None = None, dedupe_key: str | None = None) -> SmsMessage | None:
    """Add a message to the queue (caller commits). Returns None if skipped."""
    if dedupe_key and (await db.execute(select(SmsMessage.id).where(SmsMessage.dedupe_key == dedupe_key))).first():
        return None
    if patient is not None and category in PROMO_CATEGORIES and getattr(patient, "promo_opt_out", False):
        return None
    number = normalize_phone(phone)
    info = sms_info(body)
    msg = SmsMessage(
        recipient=number or str(phone or "")[:20], recipient_name=(name or "")[:200] or None,
        patient_id=getattr(patient, "id", None), user_id=user_id, body=body, category=category,
        status="queued" if number else "failed", error=None if number else "Invalid or missing phone number",
        segments=info["segments"], entity_type=entity_type, entity_id=entity_id, campaign_id=campaign_id,
        sent_by_id=sent_by_id, dedupe_key=dedupe_key,
    )
    db.add(msg)
    return msg


# ---------- background dispatch ----------

_lock = asyncio.Lock()
_pending_task: asyncio.Task | None = None
_kicked_again = False


def kick() -> None:
    """Start sending queued messages soon, without waiting (safe to call often)."""
    global _pending_task, _kicked_again
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    if _pending_task is None or _pending_task.done():
        _pending_task = loop.create_task(_drain())
    else:
        # A run is going; make it go round once more for messages queued meanwhile
        _kicked_again = True


async def _drain() -> None:
    global _kicked_again
    while True:
        _kicked_again = False
        try:
            await dispatch_queued()
        except Exception:
            log.exception("SMS dispatch failed")
            return
        if not _kicked_again:
            return


def _callback_url(token: str | None) -> str | None:
    base = (app_settings.PUBLIC_BASE_URL or "").rstrip("/")
    if not base or not token:
        return None
    return f"{base}/api/v1/public/sms/status?token={token}"


async def dispatch_queued(limit: int = 100) -> int:
    """Send queued messages in batches until none are left. Returns how many were processed."""
    total, tried = 0, set()
    while True:
        done, ids = await _dispatch_batch(limit, tried)
        total += done
        if not ids:
            return total
        # Each batch skips ids already tried, so a message stuck as queued can't loop forever
        tried.update(ids)


async def _dispatch_batch(limit: int, skip: set) -> tuple[int, list[int]]:
    from app.core.database import async_session_maker
    processed = 0
    async with _lock:
        async with async_session_maker() as db:
            q = select(SmsMessage.id).where(SmsMessage.status == "queued")
            if skip:
                q = q.where(SmsMessage.id.notin_(skip))
            ids = (await db.execute(q.order_by(SmsMessage.id).limit(limit))).scalars().all()
            if not ids:
                return 0, []
            api_key = await get_setting(db, "sms.api_key")
            sender = await get_setting(db, "sms.sender_id", "KountryEye")
            rate = await get_decimal(db, "sms.shop_rate", "0")
            cost = await get_decimal(db, "sms.cost_per_segment", "0")
            overdraft = await get_decimal(db, "sms.credit_overdraft", "20")
            token = await get_setting(db, "sms.webhook_token")
            dry = app_settings.SMS_DRY_RUN or not api_key
            for mid in ids:
                msg = await db.get(SmsMessage, mid)
                if not msg or msg.status != "queued":
                    continue
                shop_cost = (rate * msg.segments).quantize(Decimal("0.0001"))
                msg.shop_cost = shop_cost
                msg.provider_cost = (cost * msg.segments).quantize(Decimal("0.0001"))
                if not dry and (await credit_balance(db)) - shop_cost < -overdraft:
                    msg.status, msg.error = "blocked", "Shop SMS credit used up. Ask the superadmin to top up."
                elif dry:
                    msg.status, msg.sent_at = "dry_run", datetime.utcnow()
                    log.info("SMS dry run to %s: %s", msg.recipient, msg.body)
                else:
                    try:
                        result = await arkesel.send(api_key, sender, [msg.recipient], msg.body, _callback_url(token))
                        msg.status, msg.sent_at = "sent", datetime.utcnow()
                        msg.provider_id = result.get(msg.recipient) or next(iter(result.values()), None)
                        db.add(SmsCreditEntry(kind="send", amount=-shop_cost, message_id=msg.id, note=msg.category))
                    except arkesel.ArkeselError as exc:
                        msg.status, msg.error = "failed", str(exc)[:500]
                await db.commit()
                processed += 1
    return processed, list(ids)
