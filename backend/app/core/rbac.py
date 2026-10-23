"""Single source of truth for permission codes and default roles.

`ensure_rbac()` runs at startup. It only ever ADDS: missing permission rows, missing
roles that are marked `create`, and default grants for brand-new permission codes.
After the one-time Phase 3 platform/clinic role split, customisations survive restarts.
"""
from sqlalchemy import select
from sqlalchemy.orm import selectinload

# (code, name, module)
PERMISSIONS: list[tuple[str, str, str]] = [
    ("dashboard.view", "View Dashboard", "dashboard"),
    ("dashboard.admin", "View Admin Dashboard", "dashboard"),
    ("dashboard.doctor", "View Doctor Dashboard", "dashboard"),
    ("dashboard.frontdesk", "View Front Desk Dashboard", "dashboard"),
    ("dashboard.marketing", "View Marketing Dashboard", "dashboard"),
    ("patients.view", "View Patients", "patients"),
    ("patients.create", "Create Patients", "patients"),
    ("patients.edit", "Edit Patients", "patients"),
    ("patients.delete", "Delete Patients", "patients"),
    ("visits.view", "View Visits", "visits"),
    ("visits.create", "Create Visits", "visits"),
    ("visits.checkin", "Check-in Patients", "visits"),
    ("clinical.view", "View Consultations", "clinical"),
    ("clinical.create", "Create Consultations", "clinical"),
    ("clinical.queue", "Access Doctor Queue", "clinical"),
    ("prescriptions.view", "View Prescriptions", "clinical"),
    ("prescriptions.create", "Create Prescriptions", "clinical"),
    ("pos.access", "Access POS", "sales"),
    ("sales.view", "View Sales", "sales"),
    ("sales.create", "Create Sales", "sales"),
    ("sales.discount", "Apply Discounts", "sales"),
    ("sales.refund", "Process Refunds", "sales"),
    ("pos.price_override", "Change Prices at POS", "sales"),
    ("payments.view", "View Payments", "payments"),
    ("payments.create", "Process Payments", "payments"),
    ("receipts.generate", "Generate Receipts", "payments"),
    ("debtors.view", "View Debtors", "payments"),
    ("inventory.view", "View Inventory", "inventory"),
    ("inventory.manage", "Manage Inventory", "inventory"),
    ("inventory.transfer", "Transfer Stock", "inventory"),
    ("inventory.receive", "Confirm Stock Deliveries", "inventory"),
    ("warehouse.view", "View Warehouse", "inventory"),
    ("warehouse.manage", "Manage Warehouse", "inventory"),
    ("assets.view", "View Assets", "assets"),
    ("assets.manage", "Manage Assets", "assets"),
    ("marketing.view", "View Marketing", "marketing"),
    ("marketing.manage", "Manage Campaigns", "marketing"),
    ("marketing.events", "Manage Events", "marketing"),
    ("marketing.ratings", "View Ratings", "marketing"),
    ("sms.view", "View SMS Log", "sms"),
    ("sms.send", "Send Single SMS", "sms"),
    ("sms.bulk_send", "Send Bulk / Promotional SMS", "sms"),
    ("accounting.view", "View Accounting", "accounting"),
    ("accounting.manage", "Manage Accounting", "accounting"),
    ("revenue.view", "View Revenue", "revenue"),
    ("analytics.view", "View Analytics", "analytics"),
    ("audit.view", "View Audit Logs", "analytics"),
    ("employees.view", "View Employees", "employees"),
    ("employees.manage", "Manage Employees", "employees"),
    ("employees.tasks", "Assign Tasks", "employees"),
    ("attendance.clock", "Clock In/Out", "attendance"),
    ("attendance.view", "View Attendance", "attendance"),
    ("attendance.view_own", "View Own Attendance", "attendance"),
    ("attendance.view_all", "View All Attendance", "attendance"),
    ("attendance.manage", "Manage Attendance", "attendance"),
    ("branches.view", "View Branches", "branches"),
    ("branches.manage", "Manage Branches", "branches"),
    ("permissions.manage", "Manage Permissions", "permissions"),
    ("roles.manage", "Manage Roles", "permissions"),
    ("settings.view", "View Settings", "settings"),
    ("settings.manage", "Manage Settings", "settings"),
    ("fund_requests.view", "Fund Requests View", "fund_requests"),
    ("fund_requests.create", "Fund Requests Create", "fund_requests"),
    ("fund_requests.approve", "Approve Fund Requests", "fund_requests"),
    ("messages.view", "Messages View", "messages"),
    ("messages.send", "Messages Send", "messages"),
    ("technician.view", "View Technician Dashboard", "technician"),
    ("technician.scans", "Manage Scans", "technician"),
    ("technician.referrals", "Manage Referrals", "technician"),
    ("referrals.payments", "View Referral Payments", "technician"),
    ("referrals.payments.manage", "Manage Referral Payments", "technician"),
    ("lab.view", "View Lab Jobs", "lab"),
    ("lab.manage", "Update Lab Jobs", "lab"),
    ("lab.deliveries", "Record Lens Deliveries", "lab"),
]

ALL_CODES = {c for c, _, _ in PERMISSIONS}

_STAFF_BASICS = [
    "dashboard.view", "attendance.clock", "attendance.view", "attendance.view_own",
    "fund_requests.view", "fund_requests.create", "messages.view", "messages.send",
]

# key = normalised role name. `aliases` match roles created under other spellings.
ROLES: dict[str, dict] = {
    "admin": {
        "aliases": ["administrator"],
        "description": "Clinic administrator",
        "default_page": "/",
        "permissions": sorted(ALL_CODES - {"permissions.manage", "roles.manage", "branches.manage"}),
    },
    "frontdesk": {
        "aliases": ["front desk", "front_desk", "receptionist"],
        "description": "Front desk staff",
        "default_page": "/frontdesk",
        "permissions": _STAFF_BASICS + [
            "dashboard.frontdesk", "patients.view", "patients.create", "patients.edit",
            "visits.view", "visits.create", "visits.checkin", "pos.access", "sales.view",
            "sales.create", "payments.view", "payments.create", "receipts.generate",
            "debtors.view", "sms.send", "sms.view", "lab.view", "inventory.receive",
        ],
    },
    "doctor": {
        "aliases": ["optometrist"],
        "description": "Doctors and optometrists",
        "default_page": "/doctor/queue",
        "permissions": _STAFF_BASICS + [
            "dashboard.doctor", "patients.view", "patients.edit", "visits.view",
            "clinical.view", "clinical.create", "clinical.queue", "prescriptions.view",
            "prescriptions.create", "pos.access", "sales.view", "sales.create",
            "payments.view", "receipts.generate", "lab.view",
        ],
    },
    "marketing": {
        "aliases": [],
        "description": "Marketing team",
        "default_page": "/marketing",
        "permissions": _STAFF_BASICS + [
            "dashboard.marketing", "patients.view", "marketing.view", "marketing.events",
            "marketing.ratings", "sms.view", "sms.send", "sms.bulk_send",
        ],
    },
    "technician": {
        "aliases": ["clinical technician"],
        "description": "Clinical technician: scans and referrals",
        "default_page": "/technician",
        "permissions": _STAFF_BASICS + [
            "technician.view", "technician.scans", "technician.referrals",
            "patients.view", "patients.create",
        ],
    },
    "lab_technician": {
        "aliases": ["lab technician", "lab tech"],
        "description": "Makes glasses and lenses; updates job status and records lens deliveries",
        "default_page": "/lab",
        "create": True,
        "permissions": _STAFF_BASICS + [
            "lab.view", "lab.manage", "lab.deliveries", "patients.view",
            "inventory.view",
        ],
    },
}


def _norm(name: str) -> str:
    return " ".join((name or "").strip().lower().replace("_", " ").split())


def match_role_key(role_name: str) -> str | None:
    n = _norm(role_name)
    for key, spec in ROLES.items():
        if n == _norm(key) or n in (_norm(a) for a in spec["aliases"]):
            return key
    return None


async def ensure_rbac(db) -> dict:
    """Add missing permissions/roles. Safe to run on every startup."""
    from app.models.user import Permission, Role
    from app.models.settings import SystemSetting
    marker = (await db.execute(select(SystemSetting).where(SystemSetting.key == "phase3_role_defaults"))).scalar_one_or_none()

    report = {"permissions_added": [], "roles_added": [], "grants_added": 0}

    existing = {p.code: p for p in (await db.execute(select(Permission))).scalars().all()}
    # Names are unique too; don't collide with a renamed row
    taken_names = {p.name for p in existing.values()}
    new_codes = []
    for code, name, module in PERMISSIONS:
        if code in existing:
            continue
        unique_name = name if name not in taken_names else f"{name} ({code})"
        perm = Permission(code=code, name=unique_name, module=module)
        db.add(perm)
        existing[code] = perm
        taken_names.add(unique_name)
        new_codes.append(code)
    await db.flush()
    report["permissions_added"] = new_codes

    roles = (await db.execute(select(Role).options(selectinload(Role.permissions)))).scalars().all()
    by_key: dict[str, list] = {}
    for r in roles:
        k = match_role_key(r.name)
        if k:
            by_key.setdefault(k, []).append(r)

    for key, spec in ROLES.items():
        wanted = ALL_CODES if spec["permissions"] == ["*"] else set(spec["permissions"])
        matches = by_key.get(key, [])
        if not matches and spec.get("create"):
            role = Role(
                name=key, description=spec["description"], default_page=spec["default_page"],
                is_system=True, admin_may_assign=key != "admin", permissions=[existing[c] for c in sorted(wanted) if c in existing],
            )
            db.add(role)
            report["roles_added"].append(key)
            continue
        for role in matches:
            have = {p.code for p in role.permissions}
            if not have and marker is None:
                grant = wanted  # empty role: give it the defaults
            else:
                grant = wanted & set(new_codes)  # only codes introduced just now
            for code in sorted(grant - have):
                if code in existing:
                    role.permissions.append(existing[code])
                    report["grants_added"] += 1

    # One-time Phase 3 defaults. Existing accounts are never promoted or demoted.
    if marker is None:
        for role in roles:
            key = match_role_key(role.name)
            if key == "admin":
                role.permissions = [p for p in role.permissions if p.code not in {"permissions.manage", "roles.manage", "branches.manage"}]
            role.admin_may_assign = key in {"frontdesk", "doctor", "marketing", "technician", "lab_technician"}
        db.add(SystemSetting(key="phase3_role_defaults", value="1"))
    await db.commit()
    return report
