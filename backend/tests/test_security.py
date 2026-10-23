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
    ("GET", "/r/{token}"),
}
AUTH_DEPS = {"get_current_user", "get_current_active_user", "get_current_superuser", "require_admin", "checker", "gate"}


def _dep_names(dependant, acc):
    for sub in dependant.dependencies:
        acc.add(getattr(sub.call, "__name__", ""))
        _dep_names(sub, acc)
    return acc


def test_every_route_requires_login_unless_public():
    from tests.routes import api_routes
    missing, checked = [], 0
    for path, methods, dependant in api_routes(app):
        names = _dep_names(dependant, set())
        for m in methods - {"HEAD", "OPTIONS"}:
            if (m, path) in PUBLIC or path.startswith("/api/v1/public/") or path == "/r/{token}":
                continue
            checked += 1
            if not names & AUTH_DEPS:
                missing.append(f"{m} {path}")
    assert checked > 300, f"Only {checked} routes found: the route walk is broken"
    assert not missing, "Routes without a login check:\n" + "\n".join(sorted(missing))


def test_route_permission_table_covers_sensitive_modules():
    """Every route in the medical/money modules has an explicit entry (core/route_permissions.py)."""
    from tests.routes import api_routes
    from app.core.route_permissions import ROUTE_PERMISSIONS
    missing = []
    for path, methods, _ in api_routes(app):
        for prefix, table in ROUTE_PERMISSIONS.items():
            base = "/api/v1" + prefix
            if path == base or path.startswith(base + "/"):
                for m in methods - {"HEAD", "OPTIONS"}:
                    if (m, path[len(base):]) not in table:
                        missing.append(f"{m} {path}")
    assert not missing, "Add these to core/route_permissions.py:\n" + "\n".join(sorted(missing))


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
    old = auth("marketing")
    r = await client.post(f"/api/v1/employees/{seeded['marketing']}/reset-password", headers=auth("admin"))
    assert r.status_code == 200 and r.json()["temporary_password"]
    # The reset signs the old session out, and the new one may only change the password
    assert (await client.get("/api/v1/patients", headers=old)).status_code == 401
    assert (await client.get("/api/v1/patients", headers=auth("marketing"))).status_code == 403
    # Put the account back for the tests that follow
    from app.core.database import async_session_maker
    from app.models.user import User
    async with async_session_maker() as db:
        u = await db.get(User, seeded["marketing"])
        u.must_change_password = False
        await db.commit()


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


async def test_login_with_username(client, auth, seeded):
    h = auth("admin")
    r = await client.put(f"/api/v1/employees/{seeded['doctor']}", json={"username": "Dr.Kofi"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["username"] == "dr.kofi"
    ok = await client.post("/api/v1/auth/login", data={"username": "DR.KOFI", "password": PASSWORD})
    assert ok.status_code == 200
    # once a username is set, the first name no longer logs in
    bad = await client.post("/api/v1/auth/login", data={"username": "Doctor", "password": PASSWORD})
    assert bad.status_code == 401
    # usernames are unique and validated
    dup = await client.put(f"/api/v1/employees/{seeded['marketing']}", json={"username": "dr.kofi"}, headers=h)
    assert dup.status_code == 400
    invalid = await client.put(f"/api/v1/employees/{seeded['marketing']}", json={"username": "a b"}, headers=h)
    assert invalid.status_code == 400


async def test_first_name_login_still_works_without_username(client):
    r = await client.post("/api/v1/auth/login", data={"username": "Technician", "password": PASSWORD})
    assert r.status_code == 200


def test_index_migration_survives_duplicate_data(tmp_path):
    """Old databases may hold duplicates in a column that is now unique; startup must not crash."""
    import sqlite3
    from sqlalchemy import create_engine
    from app.core.database import Base, _add_missing_columns
    db = tmp_path / "old.db"
    engine = create_engine(f"sqlite:///{db}")
    Base.metadata.create_all(engine)
    con = sqlite3.connect(db)
    con.execute("DROP INDEX IF EXISTS ix_users_username")
    con.execute("INSERT INTO users (email, hashed_password, first_name, last_name, username) VALUES ('a@x.com','h','A','A','dup'), ('b@x.com','h','B','B','dup')")
    con.commit(); con.close()
    with engine.begin() as conn:
        _add_missing_columns(conn)  # must not raise
