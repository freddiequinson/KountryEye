from fastapi import APIRouter, Depends

from app.api.v1.deps import module_gate

from app.api.v1.endpoints import (
    auth, users, branches, patients, clinical,
    sales, inventory, assets, marketing, accounting, dashboard, receipts, payments, ai, settings, revenue, orders, uploads, employees, permissions, daily_verse, analytics,
    fund_requests, messaging, notifications, user_profile, system, technician_referrals, search, audit, checkout, branch_assignments, insurance
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(branches.router, prefix="/branches", tags=["Branches"], dependencies=[Depends(module_gate((), ("branches.manage", "settings.manage")))])
api_router.include_router(patients.public_router, prefix="/patients", tags=["Patients"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"], dependencies=[Depends(module_gate(("patients.view", "visits.view", "visits.create", "clinical.view", "technician.view"), ("patients.create", "patients.edit", "visits.create", "visits.checkin", "payments.create", "clinical.create")))])
api_router.include_router(clinical.router, prefix="/clinical", tags=["Clinical"], dependencies=[Depends(module_gate(("clinical.view", "clinical.queue", "prescriptions.view", "visits.view", "patients.view", "payments.view"), ("clinical.create", "prescriptions.create", "payments.create", "clinical.queue", "settings.manage")))])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"], dependencies=[Depends(module_gate(("sales.view", "pos.access", "sales.create", "inventory.view", "inventory.manage"), ("sales.create", "pos.access", "inventory.manage")))])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"], dependencies=[Depends(module_gate(("inventory.view", "inventory.manage", "pos.access"), ("inventory.manage",)))])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"], dependencies=[Depends(module_gate(("assets.view", "assets.manage"), ("assets.manage",)))])
api_router.include_router(marketing.router, prefix="/marketing", tags=["Marketing"], dependencies=[Depends(module_gate(("marketing.view", "dashboard.marketing"), ("marketing.manage", "marketing.events", "marketing.ratings")))])
api_router.include_router(accounting.router, prefix="/accounting", tags=["Accounting"], dependencies=[Depends(module_gate(("accounting.view", "accounting.manage", "revenue.view"), ("accounting.manage",)))])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"], dependencies=[Depends(module_gate(("payments.view", "payments.create"), ("payments.create",)))])
api_router.include_router(ai.router, prefix="/ai", tags=["AI"], dependencies=[Depends(module_gate(("clinical.view", "clinical.create", "settings.manage"), ("clinical.create", "settings.manage")))])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(revenue.router, prefix="/revenue", tags=["Revenue"], dependencies=[Depends(module_gate(("revenue.view", "accounting.view"), ("accounting.manage",)))])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"], dependencies=[Depends(module_gate(("sales.view", "sales.create"), ("sales.create",)))])
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["Permissions"])
api_router.include_router(daily_verse.router, tags=["Daily Verse"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"], dependencies=[Depends(module_gate(("analytics.view", "dashboard.admin"),))])
api_router.include_router(fund_requests.router, prefix="/fund-requests", tags=["Fund Requests"])
api_router.include_router(messaging.router, prefix="/messaging", tags=["Messaging"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(user_profile.router, prefix="/user-profile", tags=["User Profile"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
api_router.include_router(technician_referrals.router, prefix="/technician", tags=["Technician Referrals"], dependencies=[Depends(module_gate(("technician.view", "technician.scans", "technician.referrals", "clinical.view", "clinical.create", "patients.view", "referrals.payments", "referrals.payments.manage"), ("technician.view", "technician.scans", "technician.referrals", "clinical.create", "referrals.payments.manage")))])
api_router.include_router(search.router, prefix="/search", tags=["Search"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit"], dependencies=[Depends(module_gate(("audit.view",),))])
api_router.include_router(checkout.router, prefix="/checkout", tags=["Checkout"], dependencies=[Depends(module_gate(("payments.view", "visits.view", "pos.access"), ("payments.create", "visits.checkin", "pos.access")))])
api_router.include_router(branch_assignments.router, prefix="/branch-assignments", tags=["Branch Assignments"])
api_router.include_router(insurance.router, prefix="/insurance", tags=["Insurance"], dependencies=[Depends(module_gate((), ("settings.manage",)))])
