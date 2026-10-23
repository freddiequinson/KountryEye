"""Receipt SMS with a short link to the A5 PDF."""
import secrets
from decimal import Decimal

from app.core.config import settings as app_settings
from app.models.sms import ReceiptLink
from app.services.sms.service import queue_sms, render


def public_base() -> str:
    return (app_settings.PUBLIC_BASE_URL or app_settings.FRONTEND_URL or "").rstrip("/")


async def make_receipt_link(db, kind: str, ref_id: int) -> str:
    token = secrets.token_urlsafe(8)[:10]  # ~60 bits; the route is rate-limited
    db.add(ReceiptLink(token=token, kind=kind, ref_id=ref_id))
    return f"{public_base()}/r/{token}"


def _m(v) -> str:
    return f"{Decimal(str(v or 0)):,.2f}"


async def queue_receipt_sms(db, *, kind: str, ref_id: int, patient, amount, vat, balance, sent_by_id=None):
    """Queue 'Paid GHS x (VAT y). Bal z. Receipt: link' for a patient payment. No phone: skipped."""
    if patient is None or not getattr(patient, "phone", None):
        return None
    if Decimal(str(amount or 0)) <= 0:
        return None
    link = await make_receipt_link(db, kind, ref_id)
    body = await render(db, "receipt", amount=_m(amount), vat=_m(vat), balance=_m(balance), link=link,
                        first_name=patient.first_name)
    return await queue_sms(db, patient.phone, body, "receipt", name=f"{patient.first_name} {patient.last_name}",
                           patient=patient, entity_type=kind, entity_id=ref_id, sent_by_id=sent_by_id)
