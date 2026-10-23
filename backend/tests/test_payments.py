"""Payment flows: visit fees, part payments, prescriptions and checkout."""
import pytest


async def _setup_visit(client, auth, fee=100, phone="0241111111"):
    t = await client.post("/api/v1/clinical/types", json={"name": f"Eye test {phone}", "base_fee": fee}, headers=auth("admin"))
    assert t.status_code == 200, t.text
    p = await client.post("/api/v1/patients", json={"first_name": "Kofi", "last_name": "Boateng", "phone": phone, "branch_id": 1}, headers=auth("frontdesk"))
    assert p.status_code == 200, p.text
    v = await client.post("/api/v1/patients/visits", json={"patient_id": p.json()["id"], "visit_type": "initial", "consultation_type_id": t.json()["id"]}, headers=auth("frontdesk"))
    assert v.status_code == 200, v.text
    return p.json(), v.json(), t.json()


async def test_visit_part_payment_and_overpayment(client, auth):
    _, visit, _ = await _setup_visit(client, auth, fee=100, phone="0241000001")
    h = auth("frontdesk")
    r = await client.post(f"/api/v1/patients/visits/{visit['id']}/pay", json={"amount": 40, "payment_method": "cash"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["payment_status"] == "partial" and r.json()["balance"] == 60
    r = await client.post(f"/api/v1/patients/visits/{visit['id']}/pay", json={"amount": 100, "payment_method": "cash"}, headers=h)
    assert r.json()["applied"] == 60 and r.json()["change"] == 40 and r.json()["payment_status"] == "paid"
    r = await client.post(f"/api/v1/patients/visits/{visit['id']}/pay", json={"amount": 10}, headers=h)
    assert r.status_code == 400


async def test_doctor_cannot_take_payment(client, auth):
    _, visit, _ = await _setup_visit(client, auth, phone="0241000002")
    r = await client.post(f"/api/v1/patients/visits/{visit['id']}/pay", json={"amount": 10}, headers=auth("marketing"))
    assert r.status_code == 403


async def test_prescription_partial_payment(client, auth):
    _, visit, _ = await _setup_visit(client, auth, phone="0241000003")
    rx = await client.post(f"/api/v1/clinical/visits/{visit['id']}/prescription",
                           json={"items": [{"name": "Drops", "quantity": 2, "unit_price": 25}]}, headers=auth("doctor"))
    assert rx.status_code == 200, rx.text
    rx_id = rx.json()["prescription_id"]
    h = auth("frontdesk")
    r = await client.post(f"/api/v1/clinical/prescriptions/{rx_id}/payment", json={"amount_paid": 20, "payment_method": "cash"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "partial" and r.json()["balance"] == 30
    pending = (await client.get("/api/v1/clinical/prescriptions/pending", headers=h)).json()
    assert any(p["id"] == rx_id and p["balance"] == 30 for p in pending)
    r = await client.post(f"/api/v1/clinical/prescriptions/{rx_id}/payment", json={"amount_paid": 50}, headers=h)
    assert r.json()["status"] == "paid" and r.json()["change"] == 20


async def test_checkout_spreads_payment_and_reduces_balance(client, auth):
    patient, visit, _ = await _setup_visit(client, auth, fee=100, phone="0241000004")
    await client.post(f"/api/v1/clinical/visits/{visit['id']}/prescription",
                      json={"items": [{"name": "Drops", "quantity": 1, "unit_price": 50}]}, headers=auth("doctor"))
    h = auth("frontdesk")
    s = (await client.get(f"/api/v1/checkout/visits/{visit['id']}/checkout-summary", headers=h)).json()
    assert s["summary"]["balance_due"] == 150
    r = await client.post(f"/api/v1/checkout/visits/{visit['id']}/checkout", json={"amount": 120, "payment_method": "cash"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["balance"] == 30
    s = (await client.get(f"/api/v1/checkout/visits/{visit['id']}/checkout-summary", headers=h)).json()
    assert s["summary"]["balance_due"] == 30
    assert s["charges"]["consultation"]["balance"] == 0
    assert s["charges"]["prescriptions"]["balance"] == 30


async def test_insurance_override_fee_used(client, auth):
    h = auth("admin")
    t = (await client.post("/api/v1/clinical/types", json={"name": "Review X", "base_fee": 200}, headers=h)).json()
    ins = await client.post("/api/v1/insurance", json={"name": "Acme Health", "code": "ACME"}, headers=h)
    assert ins.status_code == 200, ins.text
    o = await client.post(f"/api/v1/insurance/{ins.json()['id']}/fee-overrides", json={"consultation_type_id": t["id"], "override_fee": 80}, headers=h)
    assert o.status_code == 200, o.text
    p = (await client.post("/api/v1/patients", json={"first_name": "Esi", "last_name": "Owusu", "phone": "0241000005", "branch_id": 1}, headers=auth("frontdesk"))).json()
    v = await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"],
                                                          "payment_type": "insurance", "insurance_provider": "Acme Health"}, headers=auth("frontdesk"))
    assert v.status_code == 200, v.text
    assert v.json()["consultation_fee"] == 80
    overrides = await client.get(f"/api/v1/insurance/{ins.json()['id']}/fee-overrides", headers=auth("frontdesk"))
    assert overrides.status_code == 200 and overrides.json()[0]["override_fee"] == 80


async def test_bulk_balances_match_per_patient(client, auth):
    from app.core.database import async_session_maker
    from app.services.balances import all_patient_balances, patient_balance
    async with async_session_maker() as db:
        bulk = await all_patient_balances(db)
        for pid, amount in bulk.items():
            assert amount == await patient_balance(db, pid)
