"""Glasses jobs and lens deliveries."""
from datetime import date, datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.sms import SmsMessage
from app.models.communication import Notification


async def _lab_user(client, auth, seeded):
    """Give the technician user the lab technician role."""
    roles = (await client.get("/api/v1/permissions/roles", headers=auth("superadmin"))).json()
    lab = next(r for r in roles if r["name"] == "lab_technician")
    r = await client.put(f"/api/v1/users/{seeded['technician']}", json={"role_id": lab["id"]}, headers=auth("superadmin"))
    assert r.status_code == 200, r.text
    return auth("technician")


async def _optical_job(client, auth, phone):
    t = (await client.post("/api/v1/clinical/types", json={"name": f"Lab exam {phone}", "base_fee": 10}, headers=auth("admin"))).json()
    p = (await client.post("/api/v1/patients", json={"first_name": "Kwame", "last_name": "Lab", "phone": phone, "branch_id": 1}, headers=auth("frontdesk"))).json()
    v = (await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"]}, headers=auth("frontdesk"))).json()
    r = await client.post(f"/api/v1/clinical/visits/{v['id']}/optical-prescription", json={"sphere_od": "-1.25", "sphere_os": "-1.00", "lens_type": "SV", "frame_code": "RB2140"}, headers=auth("doctor"))
    assert r.status_code == 200, r.text
    return p, r.json()["lab_job_id"]


async def test_glasses_job_flow_with_sms(client, auth, seeded):
    lab = await _lab_user(client, auth, seeded)
    p, job_id = await _optical_job(client, auth, "0244000001")
    jobs = (await client.get("/api/v1/lab/jobs?status=open", headers=lab)).json()
    job = next(j for j in jobs["items"] if j["id"] == job_id)
    assert job["status"] == "received" and job["rx"]["od"]["sphere"] == "-1.25"

    ready_by = (date.today() + timedelta(days=3)).isoformat()
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/start", json={"estimated_ready_date": ready_by}, headers=lab)
    assert r.status_code == 200 and r.json()["status"] == "in_progress"
    # the front desk can't change a job's progress
    assert (await client.post(f"/api/v1/lab/jobs/{job_id}/ready", headers=auth("frontdesk"))).status_code == 403
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/ready", headers=lab)
    assert r.json()["status"] == "ready"
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/collect", headers=auth("frontdesk"))
    assert r.json()["status"] == "collected"

    async with async_session_maker() as db:
        msgs = (await db.execute(select(SmsMessage).where(SmsMessage.patient_id == p["id"], SmsMessage.category == "lab").order_by(SmsMessage.id))).scalars().all()
        assert len(msgs) == 2
        assert "will be ready by" in msgs[0].body and "are ready" in msgs[1].body
        notes = (await db.execute(select(Notification).where(Notification.reference_type == "lab_job", Notification.reference_id == job_id))).scalars().all()
        assert any(n.title == "Glasses ready for pickup" for n in notes)


async def test_overdue_alert_once(client, auth, seeded):
    from app.services.lab import check_overdue
    from app.models.lab import LabJob
    _, job_id = await _optical_job(client, auth, "0244000002")
    async with async_session_maker() as db:
        job = await db.get(LabJob, job_id)
        job.status, job.estimated_ready_date = "in_progress", date.today() - timedelta(days=1)
        await db.commit()
        assert await check_overdue(db) >= 1
        await db.commit()
        assert await check_overdue(db) == 0


async def test_lens_delivery_needs_confirmation(client, auth, seeded):
    lab = await _lab_user(client, auth, seeded)
    prod = await client.post("/api/v1/lab/lens-products", json={"name": "CR-39 1.56 SV", "unit_price": 120}, headers=lab)
    assert prod.status_code == 200, prod.text
    pid = prod.json()["id"]
    d = await client.post("/api/v1/lab/deliveries", json={"destination_type": "branch", "branch_id": 1, "items": [{"product_id": pid, "quantity": 10}]}, headers=lab)
    assert d.status_code == 200, d.text
    stock = (await client.get("/api/v1/sales/stock/1", headers=auth("frontdesk"))).json()
    assert not any(s["product_id"] == pid for s in stock)  # nothing until confirmed
    # the lab can't confirm its own delivery
    assert (await client.post(f"/api/v1/lab/deliveries/{d.json()['id']}/confirm", headers=lab)).status_code == 403
    r = await client.post(f"/api/v1/lab/deliveries/{d.json()['id']}/confirm", headers=auth("frontdesk"))
    assert r.status_code == 200, r.text
    stock = (await client.get("/api/v1/sales/stock/1", headers=auth("frontdesk"))).json()
    assert next(s for s in stock if s["product_id"] == pid)["quantity"] == 10
    again = await client.post(f"/api/v1/lab/deliveries/{d.json()['id']}/confirm", headers=auth("frontdesk"))
    assert again.status_code == 400
