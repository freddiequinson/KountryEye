# Phase 3: superadmin console

Implemented locally on the branch based on staging. No production account or database is changed by this work.

## Available controls

- `/superadmin` is protected in both React and FastAPI by `User.is_superuser`.
- Tabs reuse the existing user, branch, permission and system screens. Clinic Settings keeps consultation types, VisionCare and VAT. Clinic admins use Employees to manage staff with roles marked **Clinic admins may assign this role**.
- Permission and role configuration, branch administration, server logs, generic system settings and SMS configuration belong to superadmins. VAT, consultation and insurance fees remain available through their clinic permissions. Denials take precedence over role and extra grants, including the clinic Admin role.
- SMS credentials are write-only. The browser sees whether a key is configured; neither settings reads nor change history returns its value. SMS rates, template text and automation preferences can be saved now. Delivery, balance checks, the credit ledger, top-ups, billing and scheduled jobs are Phase 4; no SMS is sent by these controls.
- Configuration history records settings, VAT, prices, consultation/insurance fees, roles, permission collections, user role/branch/active/superuser state, and branches. It includes actor, timestamp, IP and user agent. Passwords are excluded; supported credential keys are redacted.
- Revert is a new, logged change. It refuses credentials, entity creation/deletion, missing related records, duplicate reverts and snapshots with newer changes. Financial records are audited and cannot be reverted here. Reverting a product price also writes PriceHistory.
- Database events capture supported writes through existing ORM routes in the same transaction. Rollback discards both the change and its history. Direct SQL maintenance outside the ORM does not produce this trail.

## Schema and initial defaults

Startup adds `roles.admin_may_assign` and the new `change_log` table through the existing SQLite schema updater. No charge or payment columns change. A one-time `phase3_role_defaults` marker sets standard clinical/staff roles assignable and removes platform permission grants from clinic Admin defaults. Custom roles start unassignable. Superadmins can change the flag later; startup preserves their choices. Existing users retain their account, password and superuser status until the explicit handover below.

Back up the staging database before first starting this version. Keep staging SMS in dry-run mode. Do not run production cutover as part of Phase 3.

## Explicit staging account handover

The superadmin is the system owner's own account (username `superadmin`). The clinic owner keeps using `admin@kountryeyecare.com`, which becomes the clinic Admin.

From `backend/` on the server, preview first (no changes):

```bash
venv/bin/python migrations/phase3_superadmin.py \
  --database /var/www/kountryeye-staging/backend/data/kountry_eyecare.db \
  --superadmin-email theblindfolderr@gmail.com --superadmin-username superadmin \
  --superadmin-name "Freddie Quinson" \
  --clinic-admin-email admin@kountryeyecare.com --clinic-must-change-password
```

Add `--apply` to run it (add `--generate-password` to print a one-time temporary password instead of typing one). It backs up the database first, creates the superadmin (must change password at first login), removes superuser access from the clinic account, moves it to the Admin role and makes it choose a new password at next login. Production is refused.

## Usernames

Every account can have a username (3-50 letters, numbers, dots, dashes or underscores; unique, stored lower-case). Login accepts username or email. Accounts without a username can still sign in with their first name, as before. Admins set usernames from Employees (Edit details); superadmins also from the Users tab.

## Verification

Run the full backend pytest suite against its disposable SQLite database and `npm run build` in `frontend-chakra/`. The new tests cover privilege boundaries, role flags, secret redaction, numeric/collection reverts, stale and duplicate reverts, rollback, denials and account handover. Inspect the console and clinic settings in light/dark modes and at phone width before staging release.

Deployment, committing, pushing and production cutover require the owner's separate instruction. Phase 4 follows staging review of Phase 3.
