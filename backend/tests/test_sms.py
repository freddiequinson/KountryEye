"""SMS: queueing, credit and overdraft, receipts with links, campaigns, debtors, automation."""
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.sms import SmsMessage, SmsCreditEntry
from app.services.sms.text import normalize_phone, sms_info, fill


def test_phone_and_segments():
    assert normalize_phone("024 123 4567") == "233241234567"
    assert normalize_phone("+233 20 123 4567") == "233201234567"
    assert normalize_phone("12345") is None
    assert sms_info("a" * 160)["segments"] == 1 and sms_info("a" * 161)["segments"] == 2
    assert sms_info("Hello 😀")["encoding"] == "Unicode"
    assert fill("Hi {first_name}, {unknown}", first_name="Ama") == "Hi Ama, {unknown}"


async def _set(client, auth, key, value):
    r = await client.put(f"/api/v1/settings/{key}", json={"value": value}, headers=auth("superadmin"))
    assert r.status_code == 200, r.text


async def _patient(client, auth, phone, first="Abena", dob=None):
    body = {"first_name": first, "last_name": "Sms", "phone": phone, "branch_id": 1}
    if dob:
        body["date_of_birth"] = dob
    r = await client.post("/api/v1/patients", json=body, headers=auth("frontdesk"))
    assert r.status_code == 200, r.text
    return r.json()


async def _messages(**filters):
    async with async_session_maker() as db:
        q = select(SmsMessage)
        for k, v in filters.items():
            q = q.where(getattr(SmsMessage, k) == v)
        return (await db.execute(q.order_by(SmsMessage.id))).scalars().all()


async def test_receipt_sms_with_working_link(client, auth):
    from app.services.sms.service import dispatch_queued
    t = (await client.post("/api/v1/clinical/types", json={"name": "Sms exam", "base_fee": 50}, headers=auth("admin"))).json()
    p = await _patient(client, auth, "0243000001")
    v = (await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"]}, headers=auth("frontdesk"))).json()
    r = await client.post(f"/api/v1/patients/visits/{v['id']}/pay", json={"amount": 50, "payment_method": "cash"}, headers=auth("frontdesk"))
    assert r.status_code == 200
    await dispatch_queued()
    msgs = await _messages(patient_id=p["id"], category="receipt")
    assert len(msgs) == 1 and msgs[0].status == "dry_run" and msgs[0].recipient == "233243000001"
    assert "Paid GHS 50.00" in msgs[0].body
    token = msgs[0].body.rsplit("/r/", 1)[1]
    pdf = await client.get(f"/r/{token}")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    assert (await client.get("/r/notarealtoken")).status_code == 404


async def test_credit_overdraft_blocks_real_sends(client, auth, monkeypatch):
    from app.core.config import settings
    from app.services.sms import service, arkesel
    await _set(client, auth, "sms.shop_rate", "1")
    await _set(client, auth, "sms.credit_overdraft", "2")
    await _set(client, auth, "sms.api_key", "test-key")
    monkeypatch.setattr(settings, "SMS_DRY_RUN", False)
    sent = []

    async def fake_send(key, sender, recipients, message, callback_url=None):
        sent.append(recipients[0])
        return {recipients[0]: f"id-{len(sent)}"}
    monkeypatch.setattr(arkesel, "send", fake_send)
    async with async_session_maker() as db:
        start = await service.credit_balance(db)
        for i in range(6):
            await service.queue_sms(db, f"02440000{i:02d}", "Test", "manual")
        await db.commit()
    await service.dispatch_queued()
    async with async_session_maker() as db:
        end = await service.credit_balance(db)
    # spends down to the overdraft limit (-2), then blocks
    assert end >= Decimal("-2")
    assert len(sent) == int(start + 2)
    blocked = [m for m in await _messages(status="blocked")]
    assert blocked
    r = await client.post("/api/v1/superadmin/sms/topup", json={"amount": 10, "note": "test"}, headers=auth("superadmin"))
    assert r.status_code == 200
    await service.dispatch_queued()
    assert not await _messages(status="blocked")
    await _set(client, auth, "sms.shop_rate", "0")


async def test_admin_cannot_top_up(client, auth):
    r = await client.post("/api/v1/superadmin/sms/topup", json={"amount": 10}, headers=auth("admin"))
    assert r.status_code == 403


async def test_preview_and_campaign_respect_opt_out(client, auth):
    a = await _patient(client, auth, "0243100001", first="Optin")
    b = await _patient(client, auth, "0243100002", first="Optout")
    await client.put(f"/api/v1/patients/{b['id']}", json={"promo_opt_out": True}, headers=auth("frontdesk"))
    aud = {"type": "patients", "patient_ids": [a["id"], b["id"]]}
    pv = await client.post("/api/v1/sms/preview", json={"message": "Promo {first_name}", "audience": aud}, headers=auth("marketing"))
    assert pv.status_code == 200, pv.text
    assert pv.json()["recipients"] == 1 and pv.json()["skipped_opt_out"] == 1
    c = await client.post("/api/v1/sms/campaigns", json={"name": "Test promo", "message": "Promo {first_name}", "audience": aud}, headers=auth("marketing"))
    assert c.status_code == 200, c.text
    msgs = await _messages(campaign_id=c.json()["id"])
    assert len(msgs) == 1 and msgs[0].body == "Promo Optin"


async def test_frontdesk_cannot_send_bulk(client, auth):
    r = await client.post("/api/v1/sms/campaigns", json={"name": "x", "message": "x", "audience": {"type": "numbers", "numbers": "0241111111"}}, headers=auth("frontdesk"))
    assert r.status_code == 403


async def test_groups_and_numbers(client, auth):
    g = await client.post("/api/v1/sms/groups", json={"name": "VIP"}, headers=auth("marketing"))
    assert g.status_code == 200
    r = await client.post(f"/api/v1/sms/groups/{g.json()['id']}/members", json={"numbers": "0241234567\n0201234567\nnot-a-number"}, headers=auth("marketing"))
    assert r.json() == {"added": 2, "invalid": 1}


async def test_debtors_list_and_reminder(client, auth):
    t = (await client.post("/api/v1/clinical/types", json={"name": "Debt exam", "base_fee": 80}, headers=auth("admin"))).json()
    p = await _patient(client, auth, "0243200001", first="Debtor")
    v = (await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"]}, headers=auth("frontdesk"))).json()
    rows = (await client.get("/api/v1/sms/debtors", headers=auth("frontdesk"))).json()
    row = next(r for r in rows if r["patient_id"] == p["id"])
    assert row["balance"] == v["total_amount"]
    r = await client.post("/api/v1/sms/debtors/remind", json={"patient_ids": [p["id"]]}, headers=auth("frontdesk"))
    assert r.json()["queued"] == 1
    again = await client.post("/api/v1/sms/debtors/remind", json={"patient_ids": [p["id"]]}, headers=auth("frontdesk"))
    assert again.json()["queued"] == 0  # once per day


async def test_birthday_and_review_automation_runs_once(client, auth):
    from app.services import scheduler
    today = date.today()
    p = await _patient(client, auth, "0243300001", first="Birthday", dob=today.replace(year=1990).isoformat() if not (today.month == 2 and today.day == 29) else "1992-02-29")
    await _set(client, auth, "sms.automation.birthday_enabled", "true")
    await _set(client, auth, "sms.automation.birthday_time", "00:00")
    now = datetime.utcnow()
    await scheduler.tick(now)
    await scheduler.tick(now)
    msgs = await _messages(patient_id=p["id"], category="birthday")
    assert len(msgs) == 1 and "Happy birthday Birthday" in msgs[0].body


async def test_webhook_needs_token(client):
    assert (await client.get("/api/v1/public/sms/status?token=wrong&id=1&status=delivered")).status_code == 403
