"""Access-control regression tests."""
from fastapi.routing import APIRoute

from app.main import app
from tests.conftest import PASSWORD

# Routes that must work without logging in
PUBLIC = {
    ("POST", "/api/v1/auth/login"),
    ("POST", "/api/v1/auth/forgot-password"),
    ("POST", "/api/v1/auth/reset-password"),
    ("POST", "/api/v1/patients/self-register"),
    ("GET", "/api/v1/system/health"),
    ("GET", "/health"),
    ("GET", "/{full_path:path}"),
}
AUTH_DEPS = {"get_current_user", "get_current_active_user", "get_current_superuser", "require_admin", "checker", "gate"}


def _dep_names(dependant, acc):
    for sub in dependant.dependencies:
        acc.add(getattr(sub.call, "__name__", ""))
        _dep_names(sub, acc)
    return acc


def test_every_route_requires_login_unless_public():
    missing = []
    for r in app.routes:
        if not isinstance(r, APIRoute):
            continue
        names = _dep_names(r.dependant, set())
        for m in r.methods:
            if (m, r.path) in PUBLIC or r.path.startswith("/api/v1/public/"):
                continue
            if not names & AUTH_DEPS:
                missing.append(f"{m} {r.path}")
    assert not missing, "Routes without a login check:\n" + "\n".join(sorted(missing))


async def test_hard_reset_is_not_public(client):
    r = await client.post("/api/v1/system/hard-reset", json={"password": "21Savage", "reseed": True})
    assert r.status_code == 401


async def test_hard_reset_disabled_even_for_superadmin(client, auth):
    r = await client.post("/api/v1/system/hard-reset", json={"password": PASSWORD, "reseed": True}, headers=auth("superadmin"))
    assert r.status_code == 403


async def test_register_needs_superadmin(client, auth):
    body = {"email": "x@y.com", "password": "abcdefgh1", "first_name": "X", "last_name": "Y", "role_id": 1}
    assert (await client.post("/api/v1/auth/register", json=body)).status_code == 401
    assert (await client.post("/api/v1/auth/register", json=body, headers=auth("frontdesk"))).status_code == 403


async def test_user_cannot_change_own_role(client, auth, seeded):
    r = await client.put("/api/v1/users/me", json={"role_id": 1, "is_active": True, "first_name": "Fd"}, headers=auth("frontdesk"))
    assert r.status_code == 200
    me = (await client.get("/api/v1/users/me", headers=auth("frontdesk"))).json()
    assert me["first_name"] == "Fd"
    assert me["role"]["name"] == "frontdesk"


async def test_employee_management_needs_permission(client, auth, seeded):
    h = auth("frontdesk")
    assert (await client.get("/api/v1/employees", headers=h)).status_code == 403
    assert (await client.post(f"/api/v1/employees/{seeded['doctor']}/reset-password", headers=h)).status_code == 403
    assert (await client.delete(f"/api/v1/employees/{seeded['doctor']}", headers=h)).status_code == 403
    # but staff can still read their own record
    assert (await client.get(f"/api/v1/employees/{seeded['frontdesk']}", headers=h)).status_code == 200


async def test_admin_creates_employee_with_random_password(client, auth):
    roles = (await client.get("/api/v1/employees/roles/list", headers=auth("admin"))).json()
    doctor = next(r for r in roles if r["name"] == "doctor")
    body = {"email": "newdoc@example.com", "first_name": "New", "last_name": "Doc", "role_id": doctor["id"], "branch_id": 1}
    r = await client.post("/api/v1/employees", json=body, headers=auth("admin"))
    assert r.status_code == 200, r.text
    pw = r.json()["temporary_password"]
    assert pw and pw != "new123"
    login = await client.post("/api/v1/auth/login", data={"username": "newdoc@example.com", "password": pw})
    assert login.status_code == 200 and login.json()["must_change_password"] is True


async def test_clinic_admin_cannot_grant_admin_role(client, auth, seeded):
    roles = (await client.get("/api/v1/employees/roles/list", headers=auth("admin"))).json()
    admin_role = next(r for r in roles if r["name"] == "admin")
    r = await client.put(f"/api/v1/employees/{seeded['frontdesk']}", json={"role_id": admin_role["id"]}, headers=auth("admin"))
    assert r.status_code == 403


async def test_partial_employee_update_and_reset(client, auth, seeded):
    r = await client.put(f"/api/v1/employees/{seeded['marketing']}", json={"phone": "0240000000"}, headers=auth("admin"))
    assert r.status_code == 200, r.text
    r = await client.post(f"/api/v1/employees/{seeded['marketing']}/reset-password", headers=auth("admin"))
    assert r.status_code == 200 and r.json()["temporary_password"]


async def test_login_wildcards_do_not_match(client):
    r = await client.post("/api/v1/auth/login", data={"username": "%", "password": PASSWORD})
    assert r.status_code == 401
    r = await client.post("/api/v1/auth/login", data={"username": "FRONTDESK@example.com", "password": PASSWORD})
    assert r.status_code == 200


async def test_login_is_rate_limited(client):
    codes = [
        (await client.post("/api/v1/auth/login", data={"username": "doctor@example.com", "password": "wrong"})).status_code
        for _ in range(12)
    ]
    assert 429 in codes


async def test_secret_settings_hidden(client, auth):
    h = auth("superadmin")
    assert (await client.put("/api/v1/settings/sms.api_key", json={"value": "abc"}, headers=h)).status_code == 200
    assert (await client.put("/api/v1/settings/sms.api_key", json={"value": "abc"}, headers=auth("admin"))).status_code == 403
    allsettings = (await client.get("/api/v1/settings/", headers=auth("frontdesk"))).json()
    assert "sms.api_key" not in allsettings
    assert (await client.get("/api/v1/settings/sms.api_key", headers=auth("frontdesk"))).status_code == 404


async def test_settings_write_needs_permission(client, auth):
    assert (await client.put("/api/v1/settings/vat_rate", json={"value": "15"}, headers=auth("doctor"))).status_code == 403
    assert (await client.put("/api/v1/settings/vat_rate", json={"value": "15"}, headers=auth("admin"))).status_code == 200


async def test_visit_fee_route_not_shadowed(client, auth):
    r = await client.get("/api/v1/settings/visit-fees", headers=auth("frontdesk"))
    assert r.status_code == 200 and "initial_visit_fee" in r.json()


async def test_module_gates(client, auth):
    assert (await client.get("/api/v1/accounting/expenses", headers=auth("frontdesk"))).status_code == 403
    assert (await client.get("/api/v1/revenue/summary", headers=auth("doctor"))).status_code in (403,)
    assert (await client.post("/api/v1/inventory/warehouses", json={"name": "W"}, headers=auth("frontdesk"))).status_code == 403
    assert (await client.get("/api/v1/patients", headers=auth("frontdesk"))).status_code == 200


async def test_visit_receipt_needs_login(client):
    assert (await client.get("/api/v1/receipts/visit/1")).status_code == 401


async def test_permission_lists_not_open_to_all(client, auth, seeded):
    r = await client.get(f"/api/v1/permissions/users/{seeded['admin']}/effective-permissions", headers=auth("doctor"))
    assert r.status_code == 403


async def test_self_register_is_public(client):
    r = await client.post("/api/v1/patients/self-register", json={"first_name": "Ama", "last_name": "Mensah", "phone": "0201234567", "ghana_card": "GHA-1"})
    assert r.status_code == 200, r.text


async def test_patient_list_survives_bad_stored_email(client, auth):
    from app.core.database import async_session_maker
    from app.models.patient import Patient
    async with async_session_maker() as db:
        db.add(Patient(patient_number="KE-01-999999", first_name="Bad", last_name="Email", email="", branch_id=1))
        await db.commit()
    r = await client.get("/api/v1/patients", headers=auth("frontdesk"))
    assert r.status_code == 200, r.text
