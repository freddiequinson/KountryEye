"""Regression tests for the 22 Oct 2026 review: delivery races, paying before pickup,
opt-outs on pasted numbers, campaign pricing, lens-only deliveries and draining the SMS queue."""
from decimal import Decimal

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.audit import AuditLog
from app.models.clinical import PrescriptionItem
from app.models.lab import LabJob, LensDelivery, LensDeliveryItem
from app.models.patient import Patient
from app.models.sales import Product, ProductCategory, BranchStock
from app.models.sms import SmsMessage, SmsCampaign
from tests.test_lab import _lab_user, _optical_job


async def _pending_delivery(seeded, sku):
    async with async_session_maker() as db:
        p = Product(name=f"Race lens {sku}", sku=sku, unit_price=10)
        db.add(p)
        await db.flush()
        d = LensDelivery(delivery_number=f"RACE-{sku}", technician_id=seeded["technician"], destination_type="branch",
                         branch_id=1, status="pending")
        db.add(d)
        await db.flush()
        db.add(LensDeliveryItem(delivery_id=d.id, product_id=p.id, quantity=10))
        db.add(BranchStock(branch_id=1, product_id=p.id, quantity=0))
        await db.commit()
        return d.id, p.id


async def _stock(pid):
    async with async_session_maker() as db:
        return (await db.execute(select(BranchStock.quantity).where(BranchStock.product_id == pid, BranchStock.branch_id == 1))).scalar_one()


async def test_two_confirms_only_add_stock_once(client, auth, seeded):
    from app.api.v1.deps import load_user
    from app.api.v1.endpoints.lab import confirm_delivery, reject_delivery, RejectIn
    did, pid = await _pending_delivery(seeded, "RACE-1")
    # Both requests read "pending" before either writes
    async with async_session_maker() as first, async_session_maker() as second:
        assert (await first.get(LensDelivery, did)).status == "pending"
        assert (await second.get(LensDelivery, did)).status == "pending"
        u1, u2 = await load_user(first, seeded["frontdesk"]), await load_user(second, seeded["frontdesk"])
        await confirm_delivery(did, db=first, user=u1)
        with pytest.raises(HTTPException) as e:
            await confirm_delivery(did, db=second, user=u2)
        assert e.value.status_code == 400
    assert await _stock(pid) == 10

    # Confirm against reject: the loser must not change anything
    did, pid = await _pending_delivery(seeded, "RACE-2")
    async with async_session_maker() as first, async_session_maker() as second:
        await first.get(LensDelivery, did)
        await second.get(LensDelivery, did)
        u1, u2 = await load_user(first, seeded["frontdesk"]), await load_user(second, seeded["frontdesk"])
        await reject_delivery(did, RejectIn(reason="Wrong power"), db=first, user=u1)
        with pytest.raises(HTTPException):
            await confirm_delivery(did, db=second, user=u2)
    assert await _stock(pid) == 0
    async with async_session_maker() as db:
        assert (await db.get(LensDelivery, did)).status == "rejected"


async def _ready_job_owing(client, auth, phone):
    _, job_id = await _optical_job(client, auth, phone)
    async with async_session_maker() as db:
        job = await db.get(LabJob, job_id)
        job.status = "ready"
        db.add(PrescriptionItem(prescription_id=job.prescription_id, name="Lenses", item_type="lens", unit_price=100, quantity=1))
        await db.commit()
    return job_id


async def test_unpaid_glasses_cannot_be_collected(client, auth, seeded):
    lab = await _lab_user(client, auth, seeded)
    job_id = await _ready_job_owing(client, auth, "0245123001")
    # The lab can't hand glasses over at all
    assert (await client.post(f"/api/v1/lab/jobs/{job_id}/collect", headers=lab)).status_code == 403
    # Front desk is told to take payment first
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/collect", headers=auth("frontdesk"))
    assert r.status_code == 409 and "100.00" in r.json()["detail"]
    jobs = (await client.get("/api/v1/lab/jobs?status=ready", headers=auth("frontdesk"))).json()["items"]
    assert next(j for j in jobs if j["id"] == job_id)["balance"] == 100
    # Front desk can't override; an admin can, with a reason that is audited
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/collect", json={"override_reason": "Pays Friday"}, headers=auth("frontdesk"))
    assert r.status_code == 403
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/collect", json={"override_reason": "Pays Friday"}, headers=auth("admin"))
    assert r.status_code == 200 and r.json()["status"] == "collected"
    async with async_session_maker() as db:
        log = (await db.execute(select(AuditLog).where(AuditLog.action == "lab_collect_unpaid", AuditLog.entity_id == job_id))).scalar_one()
        assert "Pays Friday" in log.new_values


async def test_pasted_number_of_opted_out_patient_is_skipped(client, auth):
    async with async_session_maker() as db:
        db.add(Patient(patient_number="OPT-OUT-1", first_name="Private", last_name="Patient", phone="0245123002",
                       promo_opt_out=True, branch_id=1))
        await db.commit()
    r = await client.post("/api/v1/sms/preview", json={"message": "Promo", "audience": {"type": "numbers", "numbers": "+233 24 512 3002, 0245123099"}},
                          headers=auth("marketing"))
    assert r.json()["recipients"] == 1 and r.json()["skipped_opt_out"] == 1
    # Same for a saved group member added by phone only
    g = await client.post("/api/v1/sms/groups", json={"name": "Phone-only group"}, headers=auth("marketing"))
    assert g.status_code == 200, g.text
    r = await client.post(f"/api/v1/sms/groups/{g.json()['id']}/members", json={"numbers": "0245123002"}, headers=auth("marketing"))
    assert r.status_code == 200, r.text
    r = await client.post("/api/v1/sms/preview", json={"message": "Promo", "audience": {"type": "group", "group_id": g.json()["id"]}},
                          headers=auth("marketing"))
    assert r.json()["recipients"] == 0 and r.json()["skipped_opt_out"] == 1


async def test_campaign_priced_on_filled_in_message(client, auth, monkeypatch):
    from app.api.v1.endpoints import sms
    monkeypatch.setattr(sms, "kick", lambda: None)
    async with async_session_maker() as db:
        p = Patient(patient_number="SEG-1", first_name="A" * 40, last_name="Test", phone="0245123003", branch_id=1)
        db.add(p)
        await db.commit()
        pid = p.id
    await client.put("/api/v1/settings/sms.shop_rate", json={"value": "1"}, headers=auth("superadmin"))
    payload = {"message": "X" * 140 + " {first_name}", "audience": {"type": "patients", "patient_ids": [pid]}}
    preview = (await client.post("/api/v1/sms/preview", json=payload, headers=auth("marketing"))).json()
    c = await client.post("/api/v1/sms/campaigns", json={**payload, "name": "Segments"}, headers=auth("marketing"))
    assert c.status_code == 200, c.text
    async with async_session_maker() as db:
        msg = (await db.execute(select(SmsMessage).where(SmsMessage.campaign_id == c.json()["id"]))).scalar_one()
        campaign = await db.get(SmsCampaign, c.json()["id"])
    assert msg.segments == 2
    assert Decimal(str(preview["cost"])) == Decimal("2") == Decimal(str(campaign.shop_cost))
    await client.put("/api/v1/settings/sms.shop_rate", json={"value": "0"}, headers=auth("superadmin"))


async def test_deliveries_only_take_lens_products(client, auth, seeded):
    lab = await _lab_user(client, auth, seeded)
    async with async_session_maker() as db:
        meds = ProductCategory(name="Eye medicine", category_type="medication")
        frames = ProductCategory(name="Frames", category_type="optical")
        db.add_all([meds, frames])
        await db.flush()
        drops = Product(name="Eye drops", sku="DROPS-1", category_id=meds.id, unit_price=20)
        frame = Product(name="Frame A", sku="FRAME-1", category_id=frames.id, unit_price=200, is_active=True)
        db.add_all([drops, frame])
        await db.commit()
        ids = [drops.id, frame.id]
    for pid in ids:
        r = await client.post("/api/v1/lab/deliveries", json={"destination_type": "branch", "branch_id": 1,
                              "items": [{"product_id": pid, "quantity": 10}]}, headers=lab)
        assert r.status_code == 400
    listed = (await client.get("/api/v1/lab/lens-products", headers=lab)).json()
    assert not {p["id"] for p in listed["products"]} & set(ids)


async def test_dispatch_drains_whole_queue(client, monkeypatch):
    from app.services.sms import service
    from app.core.config import settings
    monkeypatch.setattr(settings, "SMS_DRY_RUN", True)
    async with async_session_maker() as db:
        for i in range(101):
            await service.queue_sms(db, f"0246{i:06d}", "Queue test", "manual")
        await db.commit()
    assert await service.dispatch_queued() >= 101
    async with async_session_maker() as db:
        assert not (await db.execute(select(SmsMessage.id).where(SmsMessage.status == "queued"))).first()


async def test_unpaid_linked_sale_blocks_collection(client, auth, seeded):
    from app.models.sales import Sale
    patient, job_id = await _optical_job(client, auth, "0245199001")
    async with async_session_maker() as db:
        job = await db.get(LabJob, job_id)
        job.status = "ready"
        db.add(Sale(receipt_number="LINKED-GLASSES", patient_id=patient["id"], visit_id=job.visit_id,
                    prescription_id=job.prescription_id, branch_id=1, cashier_id=seeded["frontdesk"],
                    subtotal=100, total_amount=100, paid_amount=20, payment_status="partial"))
        # A sale for something else must not block the glasses
        db.add(Sale(receipt_number="OTHER-SALE", patient_id=patient["id"], branch_id=1, cashier_id=seeded["frontdesk"],
                    subtotal=50, total_amount=50, paid_amount=0, payment_status="pending"))
        await db.commit()
    rows = (await client.get("/api/v1/lab/jobs?status=ready", headers=auth("frontdesk"))).json()["items"]
    assert next(j for j in rows if j["id"] == job_id)["balance"] == 80
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/collect", headers=auth("frontdesk"))
    assert r.status_code == 409 and "80.00" in r.json()["detail"]
    async with async_session_maker() as db:
        sale = (await db.execute(select(Sale).where(Sale.receipt_number == "LINKED-GLASSES"))).scalar_one()
        sale.paid_amount, sale.payment_status = 100, "paid"
        await db.commit()
    r = await client.post(f"/api/v1/lab/jobs/{job_id}/collect", headers=auth("frontdesk"))
    assert r.status_code == 200 and r.json()["status"] == "collected"
