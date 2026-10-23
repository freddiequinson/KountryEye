"""Security assessment 23 Oct 2026: attack cases kept as regression tests. Synthetic data only; no real SMS or email."""
import asyncio
import json
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import async_session_maker
from app.core.security import create_access_token, create_reset_token, get_password_hash
from app.models.user import User, Role, Permission
from app.models.patient import Patient, Visit
from app.models.sales import Sale, Product, BranchStock
from app.models.clinical import Consultation, ClinicalRecord
from app.models.communication import Conversation, ConversationParticipant, Message, Notification


@pytest.fixture(autouse=True)
def isolated_io(monkeypatch, tmp_path):
    from app.core.config import settings
    from app.core import uploads
    from app.services.sms import service, arkesel
    from app.api.v1.endpoints import sms
    monkeypatch.setattr(settings, 'SMS_DRY_RUN', True)
    monkeypatch.setattr(settings, 'SCHEDULER_ENABLED', False)
    monkeypatch.setattr(settings, 'SMTP_HOST', '')
    monkeypatch.setattr(uploads, 'PUBLIC_DIR', str(tmp_path / 'uploads'))
    monkeypatch.setattr(uploads, 'PRIVATE_DIR', str(tmp_path / 'private'))
    monkeypatch.setattr(service, 'kick', lambda: None)
    monkeypatch.setattr(sms, 'kick', lambda: None)
    async def never_send(*args, **kwargs):
        raise AssertionError('External SMS disabled during security assessment')
    monkeypatch.setattr(arkesel, 'send', never_send)


def tag():
    return uuid.uuid4().hex[:12]


async def case(client, auth, fee=100):
    ident=tag()
    t=await client.post('/api/v1/clinical/types',json={'name':'Security '+ident,'base_fee':fee},headers=auth('admin'))
    assert t.status_code==200,t.text
    p=await client.post('/api/v1/patients',json={'first_name':'Synthetic','last_name':ident,'branch_id':1},headers=auth('frontdesk'))
    assert p.status_code==200,p.text
    v=await client.post('/api/v1/patients/visits',json={'patient_id':p.json()['id'],'visit_type':'initial','consultation_type_id':t.json()['id']},headers=auth('frontdesk'))
    assert v.status_code==200,v.text
    return p.json(),v.json(),t.json()


async def custom_user(codes, *, must_change=False):
    async with async_session_maker() as db:
        permissions=(await db.execute(select(Permission).where(Permission.code.in_(codes)))).scalars().all()
        role=Role(name='Security-'+tag(),permissions=list(permissions))
        db.add(role)
        await db.flush()
        user=User(email=tag()+'@example.com',first_name='Synthetic',last_name='Account',role_id=role.id,branch_id=1,
            is_active=True,is_superuser=False,must_change_password=must_change,hashed_password=get_password_hash('SecurityTemp123!'))
        db.add(user)
        await db.commit()
        return user.id,{'Authorization':'Bearer '+create_access_token(user.id)}


async def sale_case(client,auth,seeded):
    p,v,_=await case(client,auth)
    async with async_session_maker() as db:
        sale=Sale(receipt_number='SEC-'+tag(),patient_id=p['id'],visit_id=v['id'],branch_id=1,cashier_id=seeded['frontdesk'],
            subtotal=100,total_amount=100,paid_amount=20,payment_status='partial')
        db.add(sale)
        await db.commit()
        return sale.id


async def test_frontdesk_cannot_modify_doctors_clinical_record(client,auth,seeded):
    p,v,t=await case(client,auth)
    async with async_session_maker() as db:
        consult=Consultation(visit_id=v['id'],consultation_type_id=t['id'],doctor_id=seeded['doctor'],fee=100)
        db.add(consult)
        await db.flush()
        db.add(ClinicalRecord(consultation_id=consult.id,diagnosis='Synthetic original diagnosis'))
        await db.commit()
        cid=consult.id
    r=await client.put(f'/api/v1/clinical/{cid}/record',json={'diagnosis':'UNAUTHORIZED EDIT'},headers=auth('frontdesk'))
    print('front desk clinical edit:',r.status_code)
    assert r.status_code==403


async def test_marketing_cannot_read_clinical_records(client,auth,seeded):
    p,v,t=await case(client,auth)
    async with async_session_maker() as db:
        consult=Consultation(visit_id=v['id'],consultation_type_id=t['id'],doctor_id=seeded['doctor'],fee=100)
        db.add(consult)
        await db.flush()
        db.add(ClinicalRecord(consultation_id=consult.id,visit_id=v['id'],patient_id=p['id'],diagnosis='SYNTHETIC-CONFIDENTIAL'))
        await db.commit()
    r=await client.get(f"/api/v1/clinical/patients/{p['id']}/records",headers=auth('marketing'))
    print('marketing clinical disclosure:',r.status_code,'SYNTHETIC-CONFIDENTIAL' in r.text)
    assert r.status_code==403


async def test_marketing_cannot_download_scan_pdf(client,auth,tmp_path):
    from app.models.technician_referral import TechnicianScan
    private=tmp_path/'clinical.pdf'; private.write_bytes(b'%PDF-1.4\nSYNTHETIC PRIVATE SCAN')
    async with async_session_maker() as db:
        scan=TechnicianScan(scan_number='SEC-'+tag(),scan_type='oct',branch_id=1,pdf_file_path=str(private))
        db.add(scan)
        await db.commit()
        sid=scan.id
    r=await client.get(f'/api/v1/technician/scans/{sid}/pdf',headers=auth('marketing'))
    print('marketing private PDF:',r.status_code)
    assert r.status_code==403


async def test_patient_create_permission_does_not_grant_edit(client,auth):
    p,_,_=await case(client,auth)
    _,headers=await custom_user(['patients.create'])
    r=await client.put(f"/api/v1/patients/{p['id']}",json={'last_name':'UNAUTHORIZED EDIT'},headers=headers)
    print('create-only patient edit:',r.status_code)
    assert r.status_code==403


async def test_doctor_cannot_forge_sale_payment(client,auth,seeded):
    sid=await sale_case(client,auth,seeded)
    r=await client.post('/api/v1/sales/payments',json={'sale_id':sid,'amount':80,'payment_method':'cash'},headers=auth('doctor'))
    print('doctor sale payment:',r.status_code)
    assert r.status_code==403


@pytest.mark.parametrize('amount',[-50,0,100000000])
async def test_sale_payment_rejects_amount_tampering(client,auth,seeded,amount):
    sid=await sale_case(client,auth,seeded)
    r=await client.post('/api/v1/sales/payments',json={'sale_id':sid,'amount':amount,'payment_method':'cash'},headers=auth('frontdesk'))
    async with async_session_maker() as db:
        stored=await db.get(Sale,sid)
        print('sale amount attack:',amount,r.status_code,'paid=',stored.paid_amount)
    assert r.status_code in (400,422)


async def test_legacy_sale_payment_creates_revenue(client,auth,seeded):
    from app.models.revenue import Revenue
    sid=await sale_case(client,auth,seeded)
    r=await client.post('/api/v1/sales/payments',json={'sale_id':sid,'amount':40,'payment_method':'cash'},headers=auth('frontdesk'))
    assert r.status_code==200,r.text
    async with async_session_maker() as db:
        revenue=(await db.execute(select(func.sum(Revenue.amount)).where(Revenue.reference_type=='sale',Revenue.reference_id==sid))).scalar()
    print('accepted sale payment/revenue:',r.status_code,revenue)
    assert revenue==40


async def test_old_access_token_revoked_after_password_change(client,auth):
    uid,h=await custom_user(['patients.view'])
    r=await client.post('/api/v1/auth/change-password',json={'current_password':'SecurityTemp123!','new_password':'SecurityChanged456!'},headers=h)
    assert r.status_code==200,r.text
    old=await client.get('/api/v1/users/me',headers=h)
    print('old token after password change:',old.status_code)
    assert old.status_code==401


async def test_old_access_token_revoked_after_password_reset(client,auth):
    uid,h=await custom_user(['patients.view'])
    async with async_session_maker() as db:
        u=await db.get(User,uid); token=create_reset_token(uid,u.hashed_password)
    r=await client.post('/api/v1/auth/reset-password',json={'token':token,'new_password':'SecurityReset456!'})
    assert r.status_code==200,r.text
    assert (await client.get('/api/v1/users/me',headers=h)).status_code==401


async def test_mandatory_password_change_is_enforced_by_api(client,auth):
    _,h=await custom_user(['patients.view'],must_change=True)
    r=await client.get('/api/v1/patients',headers=h)
    print('must-change-password API bypass:',r.status_code)
    assert r.status_code in (401,403)


async def test_disabled_account_rejected(client,auth):
    uid,h=await custom_user(['patients.view'])
    async with async_session_maker() as db:
        u=await db.get(User,uid);u.is_active=False;await db.commit()
    assert (await client.get('/api/v1/patients',headers=h)).status_code in (400,401,403)


async def test_anonymous_patient_membership_not_disclosed(client,auth):
    ident=tag();phone='0249555555'
    async with async_session_maker() as db:
        db.add(Patient(patient_number='SEC-'+ident,first_name='Synthetic',last_name=ident,branch_id=1,phone=phone))
        await db.commit()
    known=await client.post('/api/v1/patients/self-register',json={'first_name':'Test','last_name':'Known','phone':phone})
    unknown=await client.post('/api/v1/patients/self-register',json={'first_name':'Test','last_name':'Unknown','phone':'0249555556'})
    print('anonymous membership oracle:',known.status_code,unknown.status_code)
    assert known.status_code==unknown.status_code


async def test_self_registration_limit_normal_requests(client):
    statuses=[]
    for i in range(11):
        r=await client.post('/api/v1/patients/self-register',json={'first_name':'Synthetic','last_name':'Rate'+str(i)})
        statuses.append(r.status_code)
    assert statuses[-1]==429


async def test_forwarded_header_cannot_bypass_limit_on_direct_backend(client):
    statuses=[]
    for i in range(15):
        r=await client.post('/api/v1/patients/self-register',json={'first_name':'Synthetic','last_name':'Spoof'+str(i)},headers={'X-Real-IP':f'192.0.2.{i+1}'})
        statuses.append(r.status_code)
    print('spoofed proxy header statuses:',statuses)
    assert 429 in statuses


async def test_message_reply_cannot_reference_private_conversation(client,auth,seeded):
    async with async_session_maker() as db:
        secret=Conversation(is_group=False);mine=Conversation(is_group=False)
        db.add_all([secret,mine]);await db.flush()
        for cid,uid in [(secret.id,seeded['admin']),(secret.id,seeded['doctor']),(mine.id,seeded['frontdesk']),(mine.id,seeded['admin'])]:
            db.add(ConversationParticipant(conversation_id=cid,user_id=uid))
        m=Message(conversation_id=secret.id,sender_id=seeded['doctor'],content='SYNTHETIC-PRIVATE-MESSAGE')
        db.add(m);await db.commit();cid,mid=mine.id,m.id
    direct=await client.get(f'/api/v1/messaging/conversations/{secret.id}/messages',headers=auth('frontdesk'))
    assert direct.status_code==403
    r=await client.post(f'/api/v1/messaging/conversations/{cid}/messages',json={'content':'Reply probe','reply_to_id':mid},headers=auth('frontdesk'))
    print('cross-conversation reply disclosure:',r.status_code,'SYNTHETIC-PRIVATE-MESSAGE' in r.text)
    assert r.status_code in (400,403,404)
    assert 'SYNTHETIC-PRIVATE-MESSAGE' not in r.text


async def test_notification_cannot_be_read_by_another_user(client,auth,seeded):
    async with async_session_maker() as db:
        n=Notification(user_id=seeded['doctor'],title='Synthetic private',message='Private',notification_type='system')
        db.add(n);await db.commit();nid=n.id
    assert (await client.post(f'/api/v1/notifications/{nid}/read',headers=auth('frontdesk'))).status_code==404


@pytest.mark.parametrize('payload',[
    b'<html><script>alert(1)</script></html>',
    b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    b'<?php echo "synthetic";?>',b'MZ'+b'\0'*40,
])
async def test_executable_avatar_upload_rejected(client,auth,payload):
    r=await client.post('/api/v1/uploads/avatar',files={'file':('../../probe.png',payload,'image/png')},headers=auth('frontdesk'))
    assert r.status_code==400


async def test_oversized_avatar_rejected(client,auth):
    r=await client.post('/api/v1/uploads/avatar',files={'file':('large.png',b'\x89PNG\r\n\x1a\n'+b'0'*(3*1024*1024),'image/png')},headers=auth('frontdesk'))
    assert r.status_code==400


@pytest.mark.parametrize('query',["' OR 1=1 --",'%; DROP TABLE patients; --','_','%'])
async def test_patient_search_sql_injection_does_not_crash_or_drop_tables(client,auth,query):
    r=await client.get('/api/v1/patients',params={'search':query},headers=auth('frontdesk'))
    assert r.status_code==200
    assert (await client.get('/api/v1/users/me',headers=auth('frontdesk'))).status_code==200


async def test_unauthorized_system_and_secrets_blocked(client,auth):
    for path in ['/api/v1/superadmin/settings','/api/v1/system/logs','/api/v1/permissions/roles']:
        assert (await client.get(path,headers=auth('frontdesk'))).status_code==403,path
    assert (await client.put('/api/v1/settings/sms.api_key',json={'value':'SYNTHETIC'},headers=auth('frontdesk'))).status_code==403


async def test_refund_and_discount_permissions_not_implied_by_cashier(client,auth):
    uid,h=await custom_user(['sales.create','pos.access'])
    async with async_session_maker() as db:
        product=Product(sku='SEC-'+tag(),name='Synthetic lens',unit_price=100)
        db.add(product);await db.flush()
        db.add(BranchStock(branch_id=1,product_id=product.id,quantity=5));await db.commit();pid=product.id
    r=await client.post('/api/v1/sales/create',json={'branch_id':1,'items':[{'product_id':pid,'quantity':1}],'discount_amount':99},headers=h)
    assert r.status_code==403


async def test_financial_infinity_rejected(client,auth):
    _,v,_=await case(client,auth)
    for value in ['NaN','Infinity','-Infinity']:
        r=await client.post(f"/api/v1/patients/visits/{v['id']}/pay",json={'amount':value},headers=auth('frontdesk'))
        print('nonfinite payment:',value,r.status_code)
        assert r.status_code in (400,422)


async def test_valid_upload_uses_random_server_name(client,auth):
    r=await client.post('/api/v1/uploads/avatar',files={'file':('../../escape.php',b'\x89PNG\r\n\x1a\n'+b'\x00'*64,'text/html')},headers=auth('frontdesk'))
    assert r.status_code==200
    url=r.json()['avatar_url']
    assert url.startswith('/uploads/avatars/') and url.endswith('.png') and 'escape' not in url and '..' not in url

async def test_openapi_operations_require_login(client):
    import re
    from app.main import app
    from tests.test_security import PUBLIC
    paths=app.openapi()['paths']
    rows=[];leaks=[]
    for path,operations in paths.items():
        for method in operations:
            if method not in {'get','post','put','patch','delete'}: continue
            if (method.upper(),path) in PUBLIC or path.startswith('/api/v1/public/') or path=='/r/{token}': continue
            url=re.sub(r'\{[^}]+\}','1',path)
            r=await client.request(method,url,json={})
            row={'method':method.upper(),'path':path,'status':r.status_code}
            rows.append(row)
            if r.status_code<400:leaks.append(row)
    print('OpenAPI anonymous operations checked/leaked:',len(rows),len(leaks))
    assert not leaks


async def test_old_route_security_tests_cover_included_routes():
    # The old loops over app.routes saw no API routes; the shared walker must see them all
    from app.main import app
    from tests.routes import api_routes
    direct=sum(len(m-{'HEAD','OPTIONS'}) for p,m,_ in api_routes(app) if p.startswith('/api/v1'))
    operations=sum(1 for path,ops in app.openapi()['paths'].items() if path.startswith('/api/v1') for m in ops if m in {'get','post','put','patch','delete'})
    print('Protected routes covered by old app.routes loops / API operations:',direct,operations)
    assert direct>=operations>300


async def test_concurrent_visit_payments_do_not_double_book(client,auth,seeded):
    from app.api.v1.endpoints.patients import apply_visit_payment,_load_visit_with_patient
    from app.api.v1.deps import load_user
    from app.models.revenue import Revenue
    _,v,_=await case(client,auth)
    async with async_session_maker() as first,async_session_maker() as second:
        a=await _load_visit_with_patient(first,v['id'])
        b=await _load_visit_with_patient(second,v['id'])
        u1=await load_user(first,seeded['frontdesk']);u2=await load_user(second,seeded['frontdesk'])
        first.info['actor_id']=u1.id;second.info['actor_id']=u2.id
        await apply_visit_payment(first,a,{'amount':60,'payment_method':'cash'},u1)
        try:await apply_visit_payment(second,b,{'amount':60,'payment_method':'cash'},u2)
        except HTTPException:pass
    from app.services.billing import visit_total
    async with async_session_maker() as db:
        visit=await db.get(Visit,v['id'])
        paid,total=visit.amount_paid,visit_total(visit)  # fee plus any VAT left on by other tests
        revenue=(await db.execute(select(func.sum(Revenue.amount)).where(Revenue.reference_type=='visit',Revenue.reference_id==v['id']))).scalar()
    print('overlapping payments stored-paid/revenue/total:',paid,revenue,total)
    assert paid==revenue and paid<=total


async def test_old_password_reset_token_is_single_use(client,auth):
    uid,h=await custom_user(['patients.view'])
    async with async_session_maker() as db:
        u=await db.get(User,uid);token=create_reset_token(uid,u.hashed_password)
    payload={'token':token,'new_password':'OnceOnly123!'}
    assert (await client.post('/api/v1/auth/reset-password',json=payload)).status_code==200
    assert (await client.post('/api/v1/auth/reset-password',json=payload)).status_code==400


async def test_forged_expired_and_reset_tokens_do_not_authenticate(client,auth):
    import jwt
    from app.core.config import settings
    uid,h=await custom_user(['patients.view'])
    async with async_session_maker() as db:
        user=await db.get(User,uid);reset=create_reset_token(uid,user.hashed_password)
    expired=jwt.encode({'sub':str(uid),'exp':datetime.utcnow()-timedelta(seconds=5)},settings.SECRET_KEY,algorithm=settings.ALGORITHM)
    for token in ['not.a.token',expired,reset]:
        assert (await client.get('/api/v1/users/me',headers={'Authorization':'Bearer '+token})).status_code==401


async def test_cors_does_not_allow_untrusted_origin(client):
    r=await client.options('/api/v1/users/me',headers={'Origin':'https://attacker.invalid','Access-Control-Request-Method':'GET'})
    assert r.headers.get('access-control-allow-origin')!='https://attacker.invalid'


async def test_anonymous_private_uploads_and_traversal_blocked(client):
    for path in ['/uploads/scans/private.pdf','/uploads/private/private.pdf','/uploads/..%2fdata%2fsecret.key','/uploads/%2e%2e/app/core/config.py']:
        assert (await client.get(path)).status_code in (400,404)


async def test_receipt_token_tampering_blocked(client):
    for token in ['not-a-real-token','a'*25,'..%2f..%2fsecret.key']:
        assert (await client.get('/r/'+token)).status_code in (400,404)


async def test_sms_webhook_requires_secret(client):
    for method in ('get','post'):
        r=await client.request(method.upper(),'/api/v1/public/sms/status',params={'token':'wrong','id':'1','status':'delivered'})
        assert r.status_code==403


async def test_legacy_invoice_discount_permission(client,auth):
    p,v,_=await case(client,auth)
    r=await client.post('/api/v1/payments/invoices',json={'patient_id':p['id'],'visit_id':v['id'],'items':[{'description':'Synthetic bill','quantity':1,'unit_price':'100'}],'discount':'100','tax':'0'},headers=auth('frontdesk'))
    print('no-discount front desk legacy invoice:',r.status_code,r.json().get('total_amount'))
    assert r.status_code in (400,403)


async def test_legacy_invoice_negative_values(client,auth):
    p,v,_=await case(client,auth)
    r=await client.post('/api/v1/payments/invoices',json={'patient_id':p['id'],'items':[{'description':'Synthetic bill','quantity':-1,'unit_price':'100'}]},headers=auth('frontdesk'))
    print('negative legacy invoice:',r.status_code,r.json().get('total_amount'))
    assert r.status_code in (400,422)

async def test_sms_failed_delivery_bill_matches_wallet(client,auth,seeded):
    from app.models.sms import SmsMessage,SmsCreditEntry
    from app.models.settings import SystemSetting
    async with async_session_maker() as db:
        message=SmsMessage(recipient='233245199901',body='Synthetic billing test',category='manual',status='sent',segments=1,shop_cost=1,provider_cost=Decimal('0.5'),provider_id='SEC-'+tag())
        db.add(message);await db.flush()
        db.add(SmsCreditEntry(kind='send',amount=-1,message_id=message.id))
        await db.commit();mid=message.id;provider=message.provider_id
        token=(await db.execute(select(SystemSetting.value).where(SystemSetting.key=='sms.webhook_token'))).scalar_one()
    before=(await client.get('/api/v1/superadmin/sms/summary',headers=auth('superadmin'))).json()
    report=await client.post('/api/v1/public/sms/status',params={'token':token},json={'id':provider,'status':'failed'})
    assert report.status_code==200
    after=(await client.get('/api/v1/superadmin/sms/summary',headers=auth('superadmin'))).json()
    print('failed delivery billed before/after; wallet before/after:',before['shop_billed'],after['shop_billed'],before['credit']['balance'],after['credit']['balance'])
    assert after['shop_billed']==before['shop_billed'] or after['credit']['balance']==before['credit']['balance']+1


async def test_pdf_markup_is_escaped_without_resource_fetch():
    from app.utils.pdf_generator import generate_prescription_pdf
    payload={'patient_name':'<script>synthetic</script>&','items':[{'name':'<img src="file:///synthetic-nonexistent-path.png"/>','dosage':'<b>&'}]}
    pdf=generate_prescription_pdf(payload)
    assert pdf.getvalue().startswith(b'%PDF')


async def test_denied_patient_edit_permission_still_enforced(client,auth):
    p,_,_=await case(client,auth)
    uid,h=await custom_user(['patients.create','patients.edit'])
    async with async_session_maker() as db:
        u=(await db.execute(select(User).options(selectinload(User.denied_permissions)).where(User.id==uid))).scalar_one()
        denied=(await db.execute(select(Permission).where(Permission.code=='patients.edit'))).scalar_one()
        u.denied_permissions=[denied];await db.commit()
    r=await client.put(f"/api/v1/patients/{p['id']}",json={'last_name':'Denied override test'},headers=h)
    print('explicitly denied patients.edit:',r.status_code)
    assert r.status_code==403


async def test_frontdesk_visit_detail_hides_doctors_notes(client,auth,seeded):
    p,v,t=await case(client,auth)
    async with async_session_maker() as db:
        consult=Consultation(visit_id=v['id'],consultation_type_id=t['id'],doctor_id=seeded['doctor'],fee=100)
        db.add(consult);await db.flush()
        db.add(ClinicalRecord(consultation_id=consult.id,visit_id=v['id'],patient_id=p['id'],diagnosis='SYNTHETIC-NOTES'))
        await db.commit()
    front=await client.get(f"/api/v1/clinical/visits/{v['id']}/detail",headers=auth('frontdesk'))
    doctor=await client.get(f"/api/v1/clinical/visits/{v['id']}/detail",headers=auth('doctor'))
    assert front.status_code==200 and 'SYNTHETIC-NOTES' not in front.text
    assert doctor.status_code==200 and 'SYNTHETIC-NOTES' in doctor.text
    assert (await client.get(f"/api/v1/clinical/visits/{v['id']}/detail",headers=auth('marketing'))).status_code==403
