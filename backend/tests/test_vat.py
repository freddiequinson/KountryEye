"""VAT is added on top of entered prices everywhere and shows on receipts."""
import pytest


@pytest.fixture
async def vat15(client, auth):
    r = await client.put("/api/v1/settings/vat_rate", json={"value": "15"}, headers=auth("admin"))
    assert r.status_code == 200
    yield
    await client.put("/api/v1/settings/vat_rate", json={"value": "0"}, headers=auth("admin"))


async def _patient(client, auth, phone):
    r = await client.post("/api/v1/patients", json={"first_name": "Yaa", "last_name": "Asante", "phone": phone, "branch_id": 1}, headers=auth("frontdesk"))
    assert r.status_code == 200, r.text
    return r.json()


async def test_visit_fee_gets_vat(client, auth, vat15):
    t = (await client.post("/api/v1/clinical/types", json={"name": "VAT exam", "base_fee": 100}, headers=auth("admin"))).json()
    p = await _patient(client, auth, "0242000001")
    v = (await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"]}, headers=auth("frontdesk"))).json()
    assert v["consultation_fee"] == 100 and v["vat_amount"] == 15 and v["total_amount"] == 115
    r = await client.post(f"/api/v1/patients/visits/{v['id']}/pay", json={"amount": 115, "payment_method": "cash"}, headers=auth("frontdesk"))
    assert r.json()["payment_status"] == "paid"
    pdf = await client.get(f"/api/v1/receipts/visit/{v['id']}", headers=auth("frontdesk"))
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"


async def test_insurance_limit_covers_vat_inclusive_amount(client, auth, vat15):
    t = (await client.post("/api/v1/clinical/types", json={"name": "VAT exam ins", "base_fee": 100}, headers=auth("admin"))).json()
    p = await _patient(client, auth, "0242000002")
    v = (await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"],
                                                           "payment_type": "insurance", "insurance_provider": "None Co", "insurance_limit": 100}, headers=auth("frontdesk"))).json()
    # Insurer pays its 100 limit; the patient owes the remaining 15
    assert v["amount_paid"] == 100 and v["patient_topup"] == 15 and v["balance"] == 15


async def test_pos_sale_vat_and_server_price(client, auth, vat15):
    prod = await client.post("/api/v1/sales/products", json={"name": "Frame A", "unit_price": 200, "cost_price": 100, "initial_stock": 5, "branch_id": 1}, headers=auth("admin"))
    assert prod.status_code == 200, prod.text
    pid = prod.json()["id"]
    # Front desk tries to sell at 1 cedi: server uses the shelf price
    sale = await client.post("/api/v1/sales/create", json={"branch_id": 1, "items": [{"product_id": pid, "quantity": 1, "unit_price": 1}], "payment_method": "cash"}, headers=auth("frontdesk"))
    assert sale.status_code == 200, sale.text
    body = sale.json()
    assert float(body["subtotal"]) == 200 and float(body["tax_amount"]) == 30 and float(body["total_amount"]) == 230
    pdf = await client.get(f"/api/v1/receipts/sale/{body['id']}", headers=auth("frontdesk"))
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"


async def test_discount_needs_permission_and_vat_after_discount(client, auth, vat15):
    prod = (await client.post("/api/v1/sales/products", json={"name": "Frame B", "unit_price": 100, "initial_stock": 5, "branch_id": 1}, headers=auth("admin"))).json()
    r = await client.post("/api/v1/sales/create", json={"branch_id": 1, "items": [{"product_id": prod["id"], "quantity": 1}], "discount_percent": 10}, headers=auth("frontdesk"))
    assert r.status_code == 403
    r = await client.post("/api/v1/sales/create", json={"branch_id": 1, "items": [{"product_id": prod["id"], "quantity": 1}], "discount_percent": 10}, headers=auth("admin"))
    assert r.status_code == 200, r.text
    assert float(r.json()["tax_amount"]) == 13.5 and float(r.json()["total_amount"]) == 103.5


async def test_checkout_invoice_adds_up(client, auth, vat15):
    t = (await client.post("/api/v1/clinical/types", json={"name": "VAT exam co", "base_fee": 100}, headers=auth("admin"))).json()
    p = await _patient(client, auth, "0242000003")
    v = (await client.post("/api/v1/patients/visits", json={"patient_id": p["id"], "visit_type": "initial", "consultation_type_id": t["id"]}, headers=auth("frontdesk"))).json()
    await client.post(f"/api/v1/clinical/visits/{v['id']}/prescription", json={"items": [{"name": "Drops", "quantity": 2, "unit_price": 10}]}, headers=auth("doctor"))
    s = (await client.get(f"/api/v1/checkout/visits/{v['id']}/checkout-summary", headers=auth("frontdesk"))).json()
    sm = s["summary"]
    assert sm["subtotal"] == 120 and sm["vat_total"] == 18 and sm["grand_total"] == 138
    assert round(sm["subtotal"] - sm["discount"] + sm["vat_total"], 2) == sm["grand_total"]
    pdf = await client.get(f"/api/v1/checkout/visits/{v['id']}/checkout-receipt", headers=auth("frontdesk"))
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
