"""Regression coverage for the numbered 9 November QA findings."""
from datetime import datetime, timedelta
from uuid import uuid4

from app.core.database import async_session_maker
from app.models.revenue import Revenue
from tests.test_lab import _lab_user, _optical_job


async def test_exact_sku_and_received_lens_sale_receipt(client, auth, seeded):
    lab = await _lab_user(client, auth, seeded)
    product = (await client.post('/api/v1/lab/lens-products', json={'name': 'QA lens ' + uuid4().hex, 'unit_price': 200}, headers=lab)).json()
    delivery = (await client.post('/api/v1/lab/deliveries', json={'destination_type': 'branch', 'branch_id': 1, 'items': [{'product_id': product['id'], 'quantity': 3}]}, headers=lab)).json()
    assert (await client.post(f"/api/v1/lab/deliveries/{delivery['id']}/confirm", headers=auth('frontdesk'))).status_code == 200
    for term in [product['sku'], product['name']]:
        found = await client.get('/api/v1/sales/products', params={'search': term}, headers=auth('frontdesk'))
        assert found.status_code == 200
        assert any(p['id'] == product['id'] for p in found.json())
    await client.put('/api/v1/settings/vat_rate', json={'value': '20'}, headers=auth('admin'))
    try:
        for discount in [150, -1]:
            bad = await client.post('/api/v1/sales/create', json={'branch_id': 1, 'items': [{'product_id': product['id'], 'quantity': 1}], 'discount_percent': discount}, headers=auth('admin'))
            assert bad.status_code in (400, 422)
        sale = await client.post('/api/v1/sales/create', json={'branch_id': 1, 'items': [{'product_id': product['id'], 'quantity': 1}], 'payment_method': 'cash', 'amount_tendered': 240}, headers=auth('admin'))
        assert sale.status_code == 200, sale.text
        assert float(sale.json()['tax_amount']) == 40
        assert float(sale.json()['total_amount']) == 240
        receipt = await client.get(f"/api/v1/receipts/sale/{sale.json()['id']}", headers=auth('frontdesk'))
        assert receipt.status_code == 200 and receipt.content.startswith(b'%PDF')
    finally:
        await client.put('/api/v1/settings/vat_rate', json={'value': '0'}, headers=auth('admin'))


async def test_month_analytics_matches_revenue(client, auth, seeded):
    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    async with async_session_maker() as db:
        db.add(Revenue(category='other', description='Prior month QA', amount=3127.30, branch_id=1, recorded_by_id=seeded['admin'], created_at=month_start - timedelta(days=1)))
        await db.commit()
    analytics = await client.get('/api/v1/analytics/dashboard?period=month', headers=auth('admin'))
    revenue = await client.get('/api/v1/revenue/summary?period=month', headers=auth('admin'))
    assert analytics.status_code == revenue.status_code == 200
    assert analytics.json()['start_date'] == month_start.isoformat()
    assert round(analytics.json()['summary']['total_revenue'], 2) == round(revenue.json()['total'], 2)


async def test_lab_missing_phone_reports_failure(client, auth, seeded):
    lab = await _lab_user(client, auth, seeded)
    patient, job_id = await _optical_job(client, auth, '0241239876')
    from app.models.patient import Patient
    async with async_session_maker() as db:
        p = await db.get(Patient, patient['id'])
        p.phone = None
        await db.commit()
    result = await client.post(f'/api/v1/lab/jobs/{job_id}/ready', headers=lab)
    assert result.status_code == 200, result.text
    assert result.json()['sms_status'] == 'failed'
    assert 'phone' in result.json()['sms_error'].lower()


async def test_private_search_post(client, auth):
    result = await client.post('/api/v1/search/global', json={'q': 'QA lens', 'limit': 15}, headers=auth('admin'))
    assert result.status_code == 200, result.text
    assert result.json()['query'] == 'QA lens'
    assert (await client.post('/api/v1/search/global', json={'q': 'QA lens'}, headers=auth('frontdesk'))).status_code == 403
