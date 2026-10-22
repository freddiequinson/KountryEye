"""Phase 3 regressions: privilege boundaries, atomic history and safe revert."""
from sqlalchemy import select, func
from app.core.database import async_session_maker
from app.models.change_log import ChangeLog
from app.models.settings import SystemSetting
from app.models.user import Role, User
from app.models.sales import Product


async def history(client, auth, entity=None):
    r = await client.get('/api/v1/superadmin/changes', params={'per_page': 100, **({'entity_type': entity} if entity else {})}, headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    return r.json()['items']


async def test_console_is_superadmin_only(client, auth):
    for path in ('overview', 'settings', 'changes'):
        assert (await client.get(f'/api/v1/superadmin/{path}')).status_code == 401
        assert (await client.get(f'/api/v1/superadmin/{path}', headers=auth('admin'))).status_code == 403
        assert (await client.get(f'/api/v1/superadmin/{path}', headers=auth('superadmin'))).status_code == 200
    assert (await client.get('/api/v1/permissions/roles', headers=auth('admin'))).status_code == 403
    assert (await client.put('/api/v1/settings/ai_enabled', json={'value': 'true'}, headers=auth('admin'))).status_code == 403
    assert (await client.put('/api/v1/settings/vat_rate', json={'value': '15'}, headers=auth('admin'))).status_code == 200


async def test_history_redacts_secrets(client, auth):
    secret = 'super-secret-phase3-value'
    assert (await client.put('/api/v1/settings/sms.api_key', json={'value': secret}, headers=auth('superadmin'))).status_code == 200
    rows = await history(client, auth, 'system_settings')
    assert secret not in str(rows)
    assert any(r['new_value'] == '[redacted]' and not r['reversible'] for r in rows)
    r = await client.get('/api/v1/superadmin/settings', headers=auth('superadmin'))
    config = next(s for s in r.json() if s['key'] == 'sms.api_key')
    assert config['value'] is None and config['configured']


async def test_vat_revert_and_duplicate_protection(client, auth):
    for value in ('11', '12'):
        assert (await client.put('/api/v1/settings/vat_rate', json={'value': value}, headers=auth('admin'))).status_code == 200
    row = next(r for r in await history(client, auth, 'system_settings') if r['new_value'] == '12')
    assert row['reversible'] and row['changed_by'] == 'Admin Test'
    url = f"/api/v1/superadmin/changes/{row['id']}/revert"
    assert (await client.post(url, headers=auth('admin'))).status_code == 403
    r = await client.post(url, headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    assert (await client.get('/api/v1/settings/vat_rate', headers=auth('admin'))).json()['value'] == '11'
    assert (await client.post(url, headers=auth('superadmin'))).status_code == 409
    assert any(r['reverted_change_id'] == row['id'] for r in await history(client, auth))


async def test_revert_refuses_newer_changes(client, auth):
    for value in ('13', '14'):
        await client.put('/api/v1/settings/vat_rate', json={'value': value}, headers=auth('admin'))
    row = next(r for r in await history(client, auth, 'system_settings') if r['new_value'] == '13')
    assert (await client.post(f"/api/v1/superadmin/changes/{row['id']}/revert", headers=auth('superadmin'))).status_code == 409


async def test_assignable_role_flag_enforced(client, auth, seeded):
    async with async_session_maker() as db:
        role = Role(name='Restricted custom role', admin_may_assign=False)
        db.add(role)
        await db.commit()
        role_id = role.id
    url = f"/api/v1/employees/{seeded['doctor']}"
    assert (await client.put(url, json={'role_id': role_id}, headers=auth('admin'))).status_code == 403
    r = await client.put(f'/api/v1/permissions/roles/{role_id}', json={'admin_may_assign': True}, headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    assert (await client.put(url, json={'role_id': role_id}, headers=auth('admin'))).status_code == 200
    # Restore fixture role for other tests.
    async with async_session_maker() as db:
        doctor = (await db.execute(select(Role).where(Role.name == 'doctor'))).scalar_one()
        user = await db.get(User, seeded['doctor'])
        user.role_id = doctor.id
        await db.commit()


async def test_numeric_price_change_revert(client, auth, seeded):
    async with async_session_maker() as db:
        product = Product(name='History lens', sku='HISTORY-LENS', unit_price=10)
        db.add(product)
        await db.commit()
        product_id = product.id
    r = await client.put(f'/api/v1/sales/products/{product_id}', json={'unit_price': 15}, headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    row = next(r for r in await history(client, auth, 'products') if r['entity_id'] == product_id)
    r = await client.post(f"/api/v1/superadmin/changes/{row['id']}/revert", headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    async with async_session_maker() as db:
        assert (await db.get(Product, product_id)).unit_price == 10


async def test_rollback_does_not_leave_history(client, auth, seeded):
    async with async_session_maker() as db:
        db.info['actor_id'] = seeded['superadmin']
        s = SystemSetting(key='test.rollback', value='before')
        db.add(s)
        await db.commit()
        before = (await db.execute(select(func.count()).select_from(ChangeLog))).scalar_one()
        s.value = 'after'
        await db.flush()
        await db.rollback()
        after = (await db.execute(select(func.count()).select_from(ChangeLog))).scalar_one()
        assert before == after


async def test_role_permission_revert_and_denial(client, auth, seeded):
    from sqlalchemy.orm import selectinload
    from app.models.user import Permission
    async with async_session_maker() as db:
        role = Role(name='History permission role', permissions=[])
        db.add(role)
        await db.commit()
        role_id = role.id
        permission = (await db.execute(select(Permission).where(Permission.code == 'revenue.view'))).scalar_one()
        permission_id = permission.id
        accounting_id = (await db.execute(select(Permission.id).where(Permission.code == 'accounting.view'))).scalar_one()
    r = await client.put(f'/api/v1/permissions/roles/{role_id}', json={'permission_ids': [permission_id]}, headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    row = next(r for r in await history(client, auth, 'roles') if r['entity_id'] == role_id and r['field'] == 'permissions')
    assert row['old_value'] == [] and row['new_value'] == [permission_id]
    r = await client.post(f"/api/v1/superadmin/changes/{row['id']}/revert", headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    async with async_session_maker() as db:
        role = (await db.execute(select(Role).options(selectinload(Role.permissions)).where(Role.id == role_id))).scalar_one()
        assert not role.permissions
    # A denial wins over both role and extra grants, including for clinic admins.
    url = f"/api/v1/permissions/users/{seeded['admin']}/permissions"
    r = await client.put(url, json={'extra_permission_ids': [permission_id], 'denied_permission_ids': [permission_id, accounting_id]}, headers=auth('superadmin'))
    assert r.status_code == 200, r.text
    try:
        assert (await client.get('/api/v1/revenue/summary', headers=auth('admin'))).status_code == 403
        effective = (await client.get(f"/api/v1/permissions/users/{seeded['admin']}/effective-permissions", headers=auth('superadmin'))).json()
        assert 'revenue.view' not in effective['permissions']
    finally:
        await client.put(url, json={}, headers=auth('superadmin'))


async def test_user_cannot_disable_self_and_sms_input_validation(client, auth, seeded):
    assert (await client.put(f"/api/v1/users/{seeded['superadmin']}", json={'is_active': False}, headers=auth('superadmin'))).status_code == 400
    for key, value in [('sms.cost_per_segment', '-1'), ('sms.shop_rate', 'NaN'), ('sms.automation.birthday_time', '24:10'), ('sms.automation.debt_frequency', 'daily')]:
        assert (await client.put(f'/api/v1/settings/{key}', json={'value': value}, headers=auth('superadmin'))).status_code == 400
    assert (await client.get('/api/v1/settings/sms.shop_rate', headers=auth('admin'))).status_code == 404


async def test_explicit_account_handover(client, auth, seeded):
    from migrations.phase3_superadmin import apply_accounts
    from app.core.security import get_password_hash, verify_password
    async with async_session_maker() as db:
        clinic = User(email='clinic-handover@example.com', first_name='Clinic', last_name='Owner', is_superuser=True, is_active=True, hashed_password=get_password_hash('ExistingClinicPass1!'))
        db.add(clinic)
        await db.commit()
        clinic_id = clinic.id
    await apply_accounts('maddy-handover@example.com', {'clinic-handover@example.com'}, 'NewMaddyPassword1!')
    async with async_session_maker() as db:
        clinic = await db.get(User, clinic_id)
        maddy = (await db.execute(select(User).where(User.email == 'maddy-handover@example.com'))).scalar_one()
        admin_role = (await db.execute(select(Role).where(Role.name == 'admin'))).scalar_one()
        assert clinic.is_superuser is False and clinic.role_id == admin_role.id
        assert verify_password('ExistingClinicPass1!', clinic.hashed_password)
        assert maddy.is_superuser and maddy.must_change_password
        assert verify_password('NewMaddyPassword1!', maddy.hashed_password)
        trail = (await db.execute(select(ChangeLog).where(ChangeLog.entity_type == 'users', ChangeLog.entity_id == clinic.id, ChangeLog.field == 'is_superuser'))).scalars().all()
        assert trail and trail[-1].changed_by_id == maddy.id


async def test_startup_preserves_empty_permissions_and_assignment_choice(client, auth):
    from sqlalchemy.orm import selectinload
    from app.core.rbac import ensure_rbac
    async with async_session_maker() as db:
        role = (await db.execute(select(Role).options(selectinload(Role.permissions)).where(Role.name == 'technician'))).scalar_one()
        previous = list(role.permissions)
        role.permissions = []
        role.admin_may_assign = False
        await db.commit()
        try:
            await ensure_rbac(db)
            await db.refresh(role, attribute_names=['permissions', 'admin_may_assign'])
            assert not role.permissions and role.admin_may_assign is False
        finally:
            role.permissions = previous
            role.admin_may_assign = True
            await db.commit()


async def test_payments_and_deletions_are_audited(client, auth, seeded):
    from app.models.audit import AuditLog
    from app.models.revenue import Revenue
    async with async_session_maker() as db:
        db.info.update(actor_id=seeded['superadmin'], ip='127.0.0.1', user_agent='phase3-test')
        payment = Revenue(description='Synthetic audit payment', amount=25, recorded_by_id=seeded['superadmin'])
        db.add(payment)
        await db.commit()
        audit = (await db.execute(select(AuditLog).where(AuditLog.entity_type == 'revenues', AuditLog.entity_id == payment.id))).scalar_one()
        assert audit.action == 'payment' and audit.user_agent == 'phase3-test'
        product = Product(name='Synthetic deleted item', sku='HISTORY-DELETE', unit_price=1)
        db.add(product)
        await db.commit()
        product_id = product.id
        await db.delete(product)
        await db.commit()
        audit = (await db.execute(select(AuditLog).where(AuditLog.entity_type == 'products', AuditLog.entity_id == product_id, AuditLog.action == 'delete'))).scalar_one()
        assert audit.user_id == seeded['superadmin']
