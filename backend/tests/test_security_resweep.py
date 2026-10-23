"""Second security sweep (23 Oct 2026), kept as regression tests. Disposable data; outbound IO disabled."""
import json
from decimal import Decimal
from pathlib import Path
import pytest
from sqlalchemy import select,func
from tests.test_security_assessment import isolated_io,case,custom_user,tag
from app.core.database import async_session_maker
from app.models.sales import Product,BranchStock,Sale
from app.models.orders import GlassesOrder
from app.models.inventory import Warehouse,WarehouseStock,Import,ImportItem,StockTransfer,StockTransferItem
from app.models.clinical import Prescription
from app.models.communication import FundRequest
from app.models.revenue import Revenue
from app.models.patient import Visit

async def order_case(client,auth,seeded,**kw):
    p,v,_=await case(client,auth)
    async with async_session_maker() as db:
        obj=GlassesOrder(order_number='SEC-'+tag(),patient_id=p['id'],branch_id=1,created_by_id=seeded['frontdesk'],total_price=100,deposit_paid=0,balance=100,status='ready',**kw)
        db.add(obj);await db.commit();return obj.id,p,v

async def stock_case(seeded,quantity=5):
    async with async_session_maker() as db:
        p=Product(sku='SEC-'+tag(),name='Synthetic lens',unit_price=100,is_active=True)
        w=Warehouse(name='Synthetic warehouse '+tag())
        db.add_all([p,w]);await db.flush()
        db.add_all([WarehouseStock(warehouse_id=w.id,product_id=p.id,quantity=quantity),BranchStock(branch_id=1,product_id=p.id,quantity=quantity)])
        await db.commit();return p.id,w.id

@pytest.mark.parametrize('codes',[['visits.checkin'],['pos.access']])
async def test_checkout_requires_payment_authority(client,auth,codes):
    p,v,_=await case(client,auth)
    uid,h=await custom_user(codes)
    r=await client.post(f"/api/v1/checkout/visits/{v['id']}/checkout",json={'amount':100},headers=h)
    print('checkout minimal role',codes,r.status_code,r.text[:250])
    # POS itself authorizes taking payments; check-in alone must not.
    assert r.status_code==(200 if codes==['pos.access'] else 403)

async def test_create_order_cannot_forge_paid_deposit(client,auth):
    p,v,_=await case(client,auth)
    uid,h=await custom_user(['sales.create'])
    r=await client.post('/api/v1/orders/',json={'patient_id':p['id'],'lens_price':100,'deposit_paid':100},headers=h)
    print('create order with unauthorized deposit',r.status_code,r.text[:350])
    assert r.status_code in (400,403,422)

@pytest.mark.parametrize('field,value',[('lens_price',-100),('deposit_paid',-100),('deposit_paid',1000000)])
async def test_order_rejects_invalid_money(client,auth,field,value):
    p,v,_=await case(client,auth)
    payload={'patient_id':p['id'],'lens_price':100,field:value}
    r=await client.post('/api/v1/orders/',json=payload,headers=auth('frontdesk'))
    print('invalid order money',field,value,r.status_code,r.text[:280])
    assert r.status_code in (400,422)

async def test_legacy_order_cannot_be_delivered_while_owing(client,auth,seeded):
    oid,p,v=await order_case(client,auth,seeded)
    r=await client.patch(f'/api/v1/orders/{oid}/status',json={'status':'delivered'},headers=auth('frontdesk'))
    print('unpaid order handover',r.status_code,r.text)
    assert r.status_code in (400,403,409)

async def test_cancelled_order_cannot_take_payment(client,auth,seeded):
    oid,p,v=await order_case(client,auth,seeded)
    async with async_session_maker() as db:
        obj=await db.get(GlassesOrder,oid);obj.status='cancelled';await db.commit()
    r=await client.post(f'/api/v1/orders/{oid}/payment',json={'amount':100},headers=auth('frontdesk'))
    print('cancelled order charged',r.status_code,r.text)
    assert r.status_code in (400,409)

async def test_global_search_enforces_fund_request_ownership(client,auth,seeded):
    secret='PRIVATE-FUND-'+tag()
    async with async_session_maker() as db:
        req=FundRequest(title=secret,amount=1234,requested_by_id=seeded['doctor'],branch_id=1,status='pending')
        db.add(req);await db.commit();rid=req.id
    direct=await client.get(f'/api/v1/fund-requests/{rid}',headers=auth('marketing'))
    r=await client.get('/api/v1/search/global',params={'q':secret},headers=auth('marketing'))
    print('private request direct/search',direct.status_code,r.status_code,r.text)
    assert direct.status_code==403
    assert secret not in r.text

async def test_global_search_enforces_revenue_authority(client,auth,seeded):
    secret='PRIVATE-REVENUE-'+tag()
    async with async_session_maker() as db:
        db.add(Revenue(category='sales',description=secret,amount=9876,branch_id=1,recorded_by_id=seeded['frontdesk']))
        await db.commit()
    uid,h=await custom_user([])
    r=await client.get('/api/v1/search/global',params={'q':secret},headers=h)
    print('no-permission revenue search',r.status_code,r.text)
    assert secret not in r.text

@pytest.mark.parametrize('suffix',['prescription-slip','prescription'])
async def test_no_permission_cannot_download_prescription(client,auth,seeded,suffix):
    p,v,_=await case(client,auth)
    async with async_session_maker() as db:
        rx=Prescription(patient_id=p['id'],visit_id=v['id'],prescribed_by_id=seeded['doctor'],prescription_type='optical',sphere_od='-2.50',total_amount=100,status='paid')
        db.add(rx);await db.commit();rxid=rx.id
    uid,h=await custom_user([])
    r=await client.get(f'/api/v1/receipts/{suffix}/{rxid}',headers=h)
    print('no-permission prescription PDF',suffix,r.status_code,r.headers.get('content-type'),r.content[:5])
    assert r.status_code==403

async def test_import_receive_cannot_inflate_stock_on_replay(client,auth,seeded):
    pid,wid=await stock_case(seeded)
    async with async_session_maker() as db:
        obj=Import(warehouse_id=wid,created_by_id=seeded['admin']);db.add(obj);await db.flush()
        db.add(ImportItem(import_id=obj.id,product_id=pid,expected_quantity=10));await db.commit();iid=obj.id
    a=await client.put(f'/api/v1/inventory/imports/{iid}/receive',headers=auth('admin'))
    b=await client.put(f'/api/v1/inventory/imports/{iid}/receive',headers=auth('admin'))
    async with async_session_maker() as db:
        qty=(await db.execute(select(WarehouseStock.quantity).where(WarehouseStock.warehouse_id==wid,WarehouseStock.product_id==pid))).scalar_one()
    print('replay receive',a.status_code,b.status_code,'stock',qty)
    assert qty==15

@pytest.mark.parametrize('mode',['unapproved','replay','insufficient','negative'])
async def test_transfer_cannot_manipulate_stock(client,auth,seeded,mode):
    pid,wid=await stock_case(seeded)
    async with async_session_maker() as db:
        tr=StockTransfer(from_warehouse_id=wid,to_branch_id=1,requested_by_id=seeded['admin'],status='pending' if mode=='unapproved' else 'approved')
        db.add(tr);await db.flush()
        qty=10 if mode=='insufficient' else -3 if mode=='negative' else 3
        db.add(StockTransferItem(transfer_id=tr.id,product_id=pid,requested_quantity=qty,approved_quantity=None if mode=='unapproved' else qty))
        await db.commit();tid=tr.id
    r=await client.put(f'/api/v1/inventory/transfers/{tid}/complete',headers=auth('admin'))
    if mode=='replay':r=await client.put(f'/api/v1/inventory/transfers/{tid}/complete',headers=auth('admin'))
    async with async_session_maker() as db:
        wh=(await db.execute(select(WarehouseStock.quantity).where(WarehouseStock.warehouse_id==wid,WarehouseStock.product_id==pid))).scalar_one()
        br=(await db.execute(select(BranchStock.quantity).where(BranchStock.branch_id==1,BranchStock.product_id==pid))).scalar_one()
    print('transfer manipulation',mode,r.status_code,'warehouse/branch',wh,br)
    assert (wh,br)==((2,8) if mode=='replay' else (5,5))

async def test_duplicate_sale_lines_cannot_oversell(client,auth,seeded):
    pid,wid=await stock_case(seeded)
    r=await client.post('/api/v1/sales/create',json={'branch_id':1,'items':[{'product_id':pid,'quantity':4},{'product_id':pid,'quantity':4}],'payment_method':'cash','amount_tendered':800},headers=auth('frontdesk'))
    async with async_session_maker() as db:
        qty=(await db.execute(select(BranchStock.quantity).where(BranchStock.product_id==pid,BranchStock.branch_id==1))).scalar_one()
    print('duplicate sale lines',r.status_code,'remaining stock',qty)
    assert r.status_code in (400,409,422) and qty==5

@pytest.mark.parametrize('path',['/dashboard/overview','/dashboard/sales/stats','/dashboard/patients/stats'])
async def test_dashboards_require_business_permission(client,auth,path):
    uid,h=await custom_user([])
    r=await client.get('/api/v1'+path,headers=h)
    print('no-permission dashboard',path,r.status_code,r.text[:400])
    assert r.status_code==403

async def test_patient_export_does_not_create_excel_formulas(client,auth):
    import io,zipfile
    marker='=1+1'
    r=await client.post('/api/v1/patients/self-register',json={'first_name':marker,'last_name':tag(),'sex':'male','marital_status':'single'})
    assert r.status_code==200,r.text
    approved=await client.post(f"/api/v1/patients/pending-registrations/{r.json()['id']}/approve",headers=auth('frontdesk'))
    assert approved.status_code==200,approved.text
    r=await client.get('/api/v1/patients/export',params={'format':'xlsx'},headers=auth('superadmin'))
    assert r.status_code==200,r.text
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:xml=z.read('xl/worksheets/sheet1.xml').decode()
    print('attacker-controlled patient field serialized as Excel formula','<f>1+1</f>' in xml)
    assert '<f>1+1</f>' not in xml

async def test_websocket_rejects_token_after_expiry(client,auth,seeded,unused_tcp_port):
    import asyncio,uvicorn,websockets
    from datetime import timedelta
    from app.main import app
    from app.core.security import create_access_token
    from app.models.user import User
    from app.models.communication import Conversation,ConversationParticipant
    from app.api.v1.endpoints.messaging import manager
    async with async_session_maker() as db:
        u=await db.get(User,seeded['doctor']);version=u.token_version
    token=create_access_token(seeded['doctor'],expires_delta=timedelta(seconds=3),version=version)
    server=uvicorn.Server(uvicorn.Config(app,host='127.0.0.1',port=unused_tcp_port,log_level='error',lifespan='off',access_log=False))
    task=asyncio.create_task(server.serve())
    try:
        for _ in range(100):
            if server.started:break
            await asyncio.sleep(.02)
        async with websockets.connect(f'ws://127.0.0.1:{unused_tcp_port}/api/v1/messaging/ws/{seeded["doctor"]}?token={token}') as ws:
            await asyncio.sleep(3.2)
            try:
                await ws.send(json.dumps({'type':'ping'}))
                got=await asyncio.wait_for(ws.recv(),timeout=2)
                print('expired token websocket response',got)
                assert False,'Expired access token still receives pong'
            except websockets.exceptions.ConnectionClosed:
                print('expired token socket closed')
    finally:
        server.should_exit=True
        await asyncio.wait_for(task,timeout=5)

async def test_authenticated_zero_permission_route_matrix(client,auth):
    from app.main import app
    uid,h=await custom_user([])
    records=[]
    for path,methods in app.openapi()['paths'].items():
        if not path.startswith('/api/v1/') or 'get' not in methods:continue
        if any(x in path for x in ['/system/','/daily-verse','/ai/','/public/','/superadmin/']):continue
        op=methods['get'];url=path;params={}
        for p in op.get('parameters',[]):
            schema=p.get('schema',{});name=p['name']
            if p['in']=='path':url=url.replace('{'+name+'}',str(999999 if schema.get('type')=='integer' or name.endswith('_id') else 'synthetic'))
            elif p.get('required'):
                params[name]=('2026-10-23' if schema.get('format')=='date' else 'synthetic')
        try:
            r=await client.get(url,params=params,headers=h)
            records.append({'path':path,'status':r.status_code,'sample':r.text[:300] if r.status_code==200 and r.headers.get('content-type','').startswith('application/json') else ''})
        except Exception as e:records.append({'path':path,'exception':type(e).__name__})
    print('zero permission GET sweep',len(records),'operations; status counts',{str(s):sum(r.get('status')==s for r in records) for s in [200,400,401,403,404,422]})
    assert len(records)>150

async def test_insurance_reports_require_patient_and_finance_access(client,auth):
    p,v,_=await case(client,auth)
    marker='PRIVATE-POLICY-'+tag()
    async with async_session_maker() as db:
        visit=await db.get(Visit,v['id']);visit.payment_type='insurance';visit.insurance_id=marker;visit.insurance_number=marker;visit.insurance_provider='Synthetic insurer';await db.commit()
    uid,h=await custom_user([])
    r=await client.get('/api/v1/insurance/analytics/detailed',headers=h)
    print('no-permission insurance report',r.status_code,r.text[:650])
    assert marker not in r.text

async def test_membership_directory_requires_patient_access(client,auth):
    from app.models.settings import VisionCareMember
    marker='PRIVATE-MEMBER-'+tag()
    async with async_session_maker() as db:
        db.add(VisionCareMember(member_id=marker,first_name='Synthetic',last_name='Private member',phone='0200000099',email='synthetic-private@example.com',company='Private company',is_active=True));await db.commit()
    uid,h=await custom_user([])
    r=await client.get('/api/v1/settings/visioncare/members',headers=h)
    print('no-permission membership directory',r.status_code,r.text[:450])
    assert marker not in r.text

async def test_sales_view_denial_survives_inventory_read_permission(client,auth,seeded):
    from app.models.user import User,Permission
    from sqlalchemy.orm import selectinload
    p,v,_=await case(client,auth)
    async with async_session_maker() as db:
        sale=Sale(receipt_number='PRIVATE-SALE-'+tag(),patient_id=p['id'],visit_id=v['id'],branch_id=1,cashier_id=seeded['frontdesk'],subtotal=999,total_amount=999,paid_amount=999,payment_status='completed')
        db.add(sale);await db.commit();sid=sale.id
    uid,h=await custom_user(['inventory.view','sales.view'])
    async with async_session_maker() as db:
        user=(await db.execute(select(User).options(selectinload(User.denied_permissions)).where(User.id==uid))).scalar_one()
        denied=(await db.execute(select(Permission).where(Permission.code=='sales.view'))).scalar_one()
        user.denied_permissions=[denied];await db.commit()
    r=await client.get('/api/v1/sales',params={'patient_id':p['id']},headers=h)
    print('explicit sales-view denial bypassed via inventory-view',r.status_code,r.text[:400])
    assert r.status_code==403


async def test_branch_history_is_own_or_staff_manager(client,auth,seeded):
    uid,h=await custom_user([])
    assert (await client.get(f"/api/v1/branches/users/{seeded['doctor']}/assignment-history",headers=h)).status_code==403
    assert (await client.get(f"/api/v1/branches/users/{uid}/assignment-history",headers=h)).status_code==200
    assert (await client.get(f"/api/v1/branches/users/{seeded['doctor']}/assignment-history",headers=auth('admin'))).status_code==200
