"""Explicit account handover. Dry-run by default; never runs at app startup.

From backend/:
  python migrations/phase3_superadmin.py --database /path/to/staging.db \
    --superadmin-email <email> --superadmin-username superadmin --superadmin-name "First Last" \
    --clinic-admin-email <clinic-email> --clinic-must-change-password
Add --apply after reviewing the account list. The new password is entered privately,
or with --generate-password a random one is printed once.
A timestamped SQLite online backup is created before schema or account changes.
"""
import argparse
import asyncio
from datetime import datetime, timezone
from getpass import getpass
import os
from pathlib import Path
import sqlite3
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--superadmin-email', required=True)
    parser.add_argument('--superadmin-username', default=None)
    parser.add_argument('--superadmin-name', default='Super Admin')
    parser.add_argument('--clinic-must-change-password', action='store_true',
                        help='Make the clinic admin accounts choose a new password at next login')
    parser.add_argument('--generate-password', action='store_true',
                        help='Generate the superadmin temporary password and print it once')
    parser.add_argument('--clinic-admin-email', action='append', required=True)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--production', action='store_true',
                        help='Allow the production database (only at cutover, after a backup)')
    args = parser.parse_args()
    path = args.database.resolve(strict=True)
    if not path.is_file():
        parser.error('Database must be an existing SQLite file')
    if path.is_relative_to(Path('/var/www/kountryeye')) and not args.production:
        parser.error('This is the production database. Add --production at cutover to run against it.')
    email = args.superadmin_email.strip().lower()
    username = (args.superadmin_username or '').strip().lower() or None
    clinic_emails = {s.strip().lower() for s in args.clinic_admin_email}
    if email in clinic_emails:
        parser.error('The superadmin and clinic admin accounts must be different')
    with sqlite3.connect(f'file:{path}?mode=ro', uri=True) as conn:
        rows = conn.execute('SELECT id, email, is_superuser, is_active FROM users').fetchall()
        cols = [r[1] for r in conn.execute('PRAGMA table_info(users)')]
        if username and 'username' in cols:
            taken = conn.execute('SELECT email FROM users WHERE lower(username) = ?', (username,)).fetchone()
            if taken and taken[0].lower() != email:
                parser.error(f'Username {username} already belongs to {taken[0]}')
    users = {r[1].lower(): r for r in rows}
    if any(e not in users for e in clinic_emails):
        parser.error('One or more clinic admin accounts were not found')
    existing = users.get(email)
    if existing and (not existing[2] or not existing[3]):
        parser.error('The Maddy email already belongs to a non-superadmin or inactive account; choose a new email')
    print(f'Database: {path}')
    print(f'Superadmin: {email}{" / username " + username if username else ""} ({"keep existing" if existing else "create new"})')
    for e in sorted(clinic_emails):
        print(f'Clinic Admin: {e} (remove superuser access, keep account; '
              + ('must choose a new password at next login)' if args.clinic_must_change_password else 'password unchanged)'))
    others = [r[1] for r in rows if r[2] and r[1].lower() not in clinic_emails | {email}]
    if others:
        print('Other superusers left unchanged: ' + ', '.join(others))
    if not args.apply:
        print('Dry run only. No schema, accounts, or files were changed.')
        return
    password = None
    if not existing:
        if args.generate_password:
            import secrets
            password = secrets.token_urlsafe(12)
        else:
            password = getpass('New superadmin temporary password (at least 12 characters): ')
            if len(password) < 12 or password != getpass('Repeat password: '):
                parser.error('Passwords must match and contain at least 12 characters')
    backup = path.with_name(path.name + '.phase3-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.bak')
    # Restrict permissions before copying patient data into the backup.
    fd = os.open(backup, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    with sqlite3.connect(path) as source, sqlite3.connect(backup) as target:
        source.backup(target)
    print(f'Backup: {backup}')
    os.environ['DATABASE_URL'] = f'sqlite+aiosqlite:///{path}'
    first, _, last = args.superadmin_name.strip().partition(' ')
    asyncio.run(apply_accounts(email, clinic_emails, password, username=username, first_name=first or 'Super',
                               last_name=last or 'Admin', clinic_must_change=args.clinic_must_change_password))
    if password and args.generate_password:
        print(f'Temporary superadmin password (shown once): {password}')
    print('Account handover complete. New accounts must change their password on first login.')


async def apply_accounts(email, clinic_emails, password, username=None, first_name='Super', last_name='Admin',
                         clinic_must_change=False):
    from sqlalchemy import select, func
    from app.main import init_db, seed_permissions_on_startup
    from app.core.database import async_session_maker
    from app.core.security import get_password_hash
    from app.models.user import User, Role
    await init_db()
    await seed_permissions_on_startup()
    async with async_session_maker() as db:
        role = (await db.execute(select(Role).where(Role.name == 'admin'))).scalar_one_or_none()
        if role is None:
            raise RuntimeError('An admin role must exist before the handover')
        maddy = (await db.execute(select(User).where(func.lower(User.email) == email))).scalar_one_or_none()
        if maddy is None:
            maddy = User(email=email, username=username, first_name=first_name, last_name=last_name,
                         hashed_password=get_password_hash(password),
                         is_superuser=True, is_active=True, must_change_password=True, role_id=role.id)
            db.add(maddy)
            await db.flush()
        db.info['actor_id'] = maddy.id
        for clinic_email in clinic_emails:
            clinic = (await db.execute(select(User).where(func.lower(User.email) == clinic_email))).scalar_one()
            clinic.is_superuser = False
            clinic.role_id = role.id
            if clinic_must_change:
                clinic.must_change_password = True
        await db.commit()


if __name__ == '__main__':
    main()
