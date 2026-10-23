"""Shared test setup: a throwaway SQLite database, seeded roles, and a logged-in client per role."""
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="ke-test-")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_tmp}/test.db"
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production-0123456789")
os.environ.setdefault("SMS_DRY_RUN", "1")

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app, seed_permissions_on_startup
from app.core.database import init_db, async_session_maker
from app.core.security import get_password_hash, create_access_token
from app.core.ratelimit import reset_rate_limits

PASSWORD = "Passw0rd!x"


@pytest_asyncio.fixture(scope="session")
async def seeded():
    """Create schema, roles and one user per role. Returns {role_key: user_id}."""
    from sqlalchemy import select
    from app.models.user import User, Role
    from app.models.branch import Branch

    await init_db()
    async with async_session_maker() as db:
        for name in ["admin", "frontdesk", "doctor", "marketing", "technician"]:
            db.add(Role(name=name, description=name))
        db.add(Branch(name="Main", is_active=True, is_main=True))
        await db.commit()
    await seed_permissions_on_startup()

    users = {}
    async with async_session_maker() as db:
        roles = {r.name: r for r in (await db.execute(select(Role))).scalars().all()}
        branch = (await db.execute(select(Branch))).scalars().first()
        specs = [("superadmin", "admin", True)] + [(r, r, False) for r in roles]
        for key, role_name, su in specs:
            u = User(
                email=f"{key}@example.com", first_name=key.capitalize(), last_name="Test",
                hashed_password=get_password_hash(PASSWORD), role_id=roles[role_name].id,
                branch_id=branch.id, is_active=True, is_superuser=su, must_change_password=False,
            )
            db.add(u)
            await db.flush()
            users[key] = u.id
        await db.commit()
    return users


@pytest_asyncio.fixture
async def client(seeded):
    reset_rate_limits()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.fixture
def auth(seeded):
    """auth('frontdesk') -> headers for that user."""
    import sqlite3

    def make(key: str) -> dict:
        # Use the account's current login version: tests that reset a password sign it out
        with sqlite3.connect(f"{_tmp}/test.db") as conn:
            row = conn.execute("SELECT token_version FROM users WHERE id = ?", (seeded[key],)).fetchone()
        version = (row[0] or 0) if row else 0
        return {"Authorization": f"Bearer {create_access_token(subject=seeded[key], version=version)}"}
    return make
