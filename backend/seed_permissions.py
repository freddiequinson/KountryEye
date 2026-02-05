import asyncio
from app.core.database import async_session_maker
from app.models.user import Permission, Role
from sqlalchemy import select
from sqlalchemy.orm import selectinload

DEFAULT_PERMISSIONS = [
    {'name': 'View Dashboard', 'code': 'dashboard.view', 'module': 'dashboard'},
    {'name': 'View Admin Dashboard', 'code': 'dashboard.admin', 'module': 'dashboard'},
    {'name': 'View Doctor Dashboard', 'code': 'dashboard.doctor', 'module': 'dashboard'},
    {'name': 'View Front Desk Dashboard', 'code': 'dashboard.frontdesk', 'module': 'dashboard'},
    {'name': 'View Marketing Dashboard', 'code': 'dashboard.marketing', 'module': 'dashboard'},
    {'name': 'View Patients', 'code': 'patients.view', 'module': 'patients'},
    {'name': 'Create Patients', 'code': 'patients.create', 'module': 'patients'},
    {'name': 'Edit Patients', 'code': 'patients.edit', 'module': 'patients'},
    {'name': 'View Visits', 'code': 'visits.view', 'module': 'visits'},
    {'name': 'Create Visits', 'code': 'visits.create', 'module': 'visits'},
    {'name': 'Check-in Patients', 'code': 'visits.checkin', 'module': 'visits'},
    {'name': 'View Consultations', 'code': 'clinical.view', 'module': 'clinical'},
    {'name': 'Create Consultations', 'code': 'clinical.create', 'module': 'clinical'},
    {'name': 'View Prescriptions', 'code': 'prescriptions.view', 'module': 'clinical'},
    {'name': 'Create Prescriptions', 'code': 'prescriptions.create', 'module': 'clinical'},
    {'name': 'Access Doctor Queue', 'code': 'clinical.queue', 'module': 'clinical'},
    {'name': 'Access POS', 'code': 'pos.access', 'module': 'sales'},
    {'name': 'View Sales', 'code': 'sales.view', 'module': 'sales'},
    {'name': 'Create Sales', 'code': 'sales.create', 'module': 'sales'},
    {'name': 'View Payments', 'code': 'payments.view', 'module': 'payments'},
    {'name': 'Process Payments', 'code': 'payments.create', 'module': 'payments'},
    {'name': 'Generate Receipts', 'code': 'receipts.generate', 'module': 'payments'},
    {'name': 'View Inventory', 'code': 'inventory.view', 'module': 'inventory'},
    {'name': 'Manage Inventory', 'code': 'inventory.manage', 'module': 'inventory'},
    {'name': 'View Assets', 'code': 'assets.view', 'module': 'assets'},
    {'name': 'View Marketing', 'code': 'marketing.view', 'module': 'marketing'},
    {'name': 'Manage Events', 'code': 'marketing.events', 'module': 'marketing'},
    {'name': 'View Ratings', 'code': 'marketing.ratings', 'module': 'marketing'},
    {'name': 'View Employees', 'code': 'employees.view', 'module': 'employees'},
    {'name': 'Manage Employees', 'code': 'employees.manage', 'module': 'employees'},
    {'name': 'View Branches', 'code': 'branches.view', 'module': 'branches'},
    {'name': 'Manage Branches', 'code': 'branches.manage', 'module': 'branches'},
    {'name': 'View Settings', 'code': 'settings.view', 'module': 'settings'},
    {'name': 'Manage Settings', 'code': 'settings.manage', 'module': 'settings'},
    {'name': 'Manage Permissions', 'code': 'permissions.manage', 'module': 'settings'},
    {'name': 'View Revenue', 'code': 'revenue.view', 'module': 'accounting'},
    {'name': 'View Accounting', 'code': 'accounting.view', 'module': 'accounting'},
    {'name': 'Clock In/Out', 'code': 'attendance.clock', 'module': 'attendance'},
    {'name': 'View Own Attendance', 'code': 'attendance.view_own', 'module': 'attendance'},
    {'name': 'View All Attendance', 'code': 'attendance.view_all', 'module': 'attendance'},
    {'name': 'View Attendance', 'code': 'attendance.view', 'module': 'attendance'},
    {'name': 'View Analytics', 'code': 'analytics.view', 'module': 'analytics'},
    {'name': 'View Fund Requests', 'code': 'fund_requests.view', 'module': 'fund_requests'},
    {'name': 'Create Fund Requests', 'code': 'fund_requests.create', 'module': 'fund_requests'},
    {'name': 'View Messages', 'code': 'messages.view', 'module': 'messaging'},
    {'name': 'Send Messages', 'code': 'messages.send', 'module': 'messaging'},
    # Technician permissions
    {'name': 'View Technician Dashboard', 'code': 'technician.view', 'module': 'technician'},
    {'name': 'Manage Referrals', 'code': 'technician.referrals', 'module': 'technician'},
    {'name': 'Manage Scans', 'code': 'technician.scans', 'module': 'technician'},
    {'name': 'View Referral Payments', 'code': 'referrals.payments', 'module': 'technician'},
    {'name': 'Manage Referral Payments', 'code': 'referrals.payments.manage', 'module': 'technician'},
]

ROLE_PERMISSIONS = {
    'doctor': [
        'dashboard.view', 'dashboard.doctor',
        'patients.view', 'patients.edit',
        'visits.view',
        'clinical.view', 'clinical.create', 'clinical.queue',
        'prescriptions.view', 'prescriptions.create',
        'pos.access', 'sales.view', 'sales.create',
        'payments.view', 'receipts.generate',
        'attendance.clock', 'attendance.view_own', 'attendance.view',
        'fund_requests.view', 'fund_requests.create',
        'messages.view', 'messages.send',
    ],
    'frontdesk': [
        'dashboard.view', 'dashboard.frontdesk',
        'patients.view', 'patients.create', 'patients.edit',
        'visits.view', 'visits.create', 'visits.checkin',
        'pos.access', 'sales.view', 'sales.create',
        'payments.view', 'payments.create', 'receipts.generate',
        'attendance.clock', 'attendance.view_own', 'attendance.view',
        'fund_requests.view', 'fund_requests.create',
        'messages.view', 'messages.send',
    ],
    'marketing': [
        'dashboard.view', 'dashboard.marketing',
        'marketing.view', 'marketing.events', 'marketing.ratings',
        'patients.view',
        'attendance.clock', 'attendance.view_own', 'attendance.view',
        'fund_requests.view', 'fund_requests.create',
        'messages.view', 'messages.send',
    ],
    'admin': [
        'dashboard.view', 'dashboard.admin', 'dashboard.doctor', 'dashboard.frontdesk', 'dashboard.marketing',
        'patients.view', 'patients.create', 'patients.edit',
        'visits.view', 'visits.create', 'visits.checkin',
        'clinical.view', 'clinical.create', 'clinical.queue',
        'prescriptions.view', 'prescriptions.create',
        'pos.access', 'sales.view', 'sales.create',
        'payments.view', 'payments.create', 'receipts.generate',
        'inventory.view', 'inventory.manage',
        'assets.view',
        'marketing.view', 'marketing.events', 'marketing.ratings',
        'employees.view', 'employees.manage',
        'branches.view', 'branches.manage',
        'settings.view', 'settings.manage', 'permissions.manage',
        'revenue.view', 'accounting.view',
        'attendance.clock', 'attendance.view_own', 'attendance.view_all', 'attendance.view',
        'analytics.view',
        'fund_requests.view', 'fund_requests.create',
        'messages.view', 'messages.send',
        # Admin also gets technician management
        'technician.view', 'technician.referrals', 'technician.scans',
        'referrals.payments', 'referrals.payments.manage',
    ],
    'technician': [
        'dashboard.view',
        'technician.view', 'technician.referrals', 'technician.scans',
        'patients.view', 'patients.create',
        'attendance.clock', 'attendance.view_own', 'attendance.view',
        'fund_requests.view', 'fund_requests.create',
        'messages.view', 'messages.send',
    ],
}

async def seed():
    async with async_session_maker() as db:
        # Create permissions
        print("Creating permissions...")
        for perm_data in DEFAULT_PERMISSIONS:
            existing = await db.execute(select(Permission).where(Permission.code == perm_data['code']))
            if not existing.scalar_one_or_none():
                perm = Permission(**perm_data)
                db.add(perm)
                print(f'  Created: {perm_data["code"]}')
        await db.commit()
        
        # Get all permissions
        all_perms_result = await db.execute(select(Permission))
        all_permissions = {p.code: p for p in all_perms_result.scalars().all()}
        print(f"\nTotal permissions in DB: {len(all_permissions)}")
        
        # Assign permissions to roles
        print("\nAssigning permissions to roles...")
        for role_name, perm_codes in ROLE_PERMISSIONS.items():
            result = await db.execute(
                select(Role).options(selectinload(Role.permissions)).where(Role.name == role_name)
            )
            role = result.scalar_one_or_none()
            if role:
                permissions = [all_permissions[code] for code in perm_codes if code in all_permissions]
                role.permissions = permissions
                print(f'  {role_name}: assigned {len(permissions)} permissions')
            else:
                print(f'  {role_name}: role not found')
        
        await db.commit()
        print("\nDone!")

if __name__ == "__main__":
    asyncio.run(seed())
