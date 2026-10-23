"""Routes that work without logging in: receipt links sent by SMS and Arkesel delivery reports."""
import hmac
import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.ratelimit import rate_limit
from app.models.sms import ReceiptLink, SmsMessage

router = APIRouter()          # mounted at /api/v1/public
receipt_router = APIRouter()  # mounted at the site root: /r/{token}


@receipt_router.get("/r/{token}", dependencies=[Depends(rate_limit("receipt-link", 30, 60))])
async def open_receipt(token: str, db: AsyncSession = Depends(get_db)):
    """The A5 receipt PDF behind an SMS link. Unknown tokens get a plain 404."""
    if not (6 <= len(token) <= 24) or not token.replace("-", "").replace("_", "").isalnum():
        raise HTTPException(status_code=404, detail="Receipt not found")
    link = await db.get(ReceiptLink, token)
    if not link:
        raise HTTPException(status_code=404, detail="Receipt not found")
    link.opened_count = (link.opened_count or 0) + 1
    await db.commit()

    from app.utils.pdf_generator import generate_receipt_pdf, generate_checkout_receipt_pdf
    if link.kind == "checkout":
        from sqlalchemy.orm import selectinload
        from app.models.patient import Visit
        from app.api.v1.endpoints.checkout import get_visit_checkout_summary
        visit = (await db.execute(select(Visit).options(selectinload(Visit.patient), selectinload(Visit.branch)).where(Visit.id == link.ref_id))).scalar_one_or_none()
        if not visit:
            raise HTTPException(status_code=404, detail="Receipt not found")
        summary = await get_visit_checkout_summary(visit.id, db, None)
        pdf = io.BytesIO(generate_checkout_receipt_pdf(visit=visit, patient=visit.patient, summary=summary, branch=visit.branch))
    else:
        from app.services.receipts import BUILDERS
        builder = BUILDERS.get(link.kind)
        data = await builder(db, link.ref_id) if builder else None
        if not data:
            raise HTTPException(status_code=404, detail="Receipt not found")
        pdf = generate_receipt_pdf(data)
    return StreamingResponse(pdf, media_type="application/pdf", headers={
        "Content-Disposition": f'inline; filename="kountry-eyecare-receipt-{token}.pdf"',
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex",
    })


_STATUS = {"delivered": "delivered", "delivrd": "delivered", "success": "delivered", "sent": "sent",
           "submitted": "sent", "failed": "failed", "undelivered": "failed", "undeliv": "failed",
           "rejected": "failed", "expired": "failed"}


@router.api_route("/sms/status", methods=["GET", "POST"], dependencies=[Depends(rate_limit("sms-webhook", 300, 60))])
async def sms_delivery_report(request: Request, token: str = "", db: AsyncSession = Depends(get_db)):
    """Arkesel calls this with the message id and its delivery status."""
    from app.services.sms.service import get_setting
    expected = await get_setting(db, "sms.webhook_token")
    if not expected or not hmac.compare_digest(str(token), str(expected)):
        raise HTTPException(status_code=403, detail="Forbidden")
    data = dict(request.query_params)
    if request.method == "POST":
        try:
            body = await request.json()
            if isinstance(body, dict):
                data.update({k: v for k, v in body.items() if isinstance(v, (str, int))})
        except Exception:
            form = await request.form()
            data.update({k: v for k, v in form.items() if isinstance(v, str)})
    provider_id = str(data.get("sms_id") or data.get("id") or data.get("message_id") or "")[:100]
    status = _STATUS.get(str(data.get("status") or "").strip().lower())
    if provider_id and status:
        msg = (await db.execute(select(SmsMessage).where(SmsMessage.provider_id == provider_id))).scalars().first()
        if msg and msg.status in ("sent", "delivered", "failed"):
            msg.status = status
            if status == "delivered":
                msg.delivered_at = datetime.utcnow()
            elif status == "failed":
                msg.error = "Not delivered by the network"
            await db.commit()
    return {"ok": True}
