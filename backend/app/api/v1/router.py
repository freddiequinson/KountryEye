from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth, users, branches, patients, clinical,
    sales, inventory, assets, marketing, accounting, dashboard, receipts, payments, ai, settings, revenue, orders, uploads, employees, permissions, daily_verse, analytics,
    fund_requests, messaging, notifications, user_profile, system
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(branches.router, prefix="/branches", tags=["Branches"])
api_router.include_router(patients.router, prefix="/patients", tags=["Patients"])
api_router.include_router(clinical.router, prefix="/clinical", tags=["Clinical"])
api_router.include_router(sales.router, prefix="/sales", tags=["Sales"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(assets.router, prefix="/assets", tags=["Assets"])
api_router.include_router(marketing.router, prefix="/marketing", tags=["Marketing"])
api_router.include_router(accounting.router, prefix="/accounting", tags=["Accounting"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
api_router.include_router(receipts.router, prefix="/receipts", tags=["Receipts"])
api_router.include_router(payments.router, prefix="/payments", tags=["Payments"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI"])
api_router.include_router(settings.router, prefix="/settings", tags=["Settings"])
api_router.include_router(revenue.router, prefix="/revenue", tags=["Revenue"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["Uploads"])
api_router.include_router(employees.router, prefix="/employees", tags=["Employees"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["Permissions"])
api_router.include_router(daily_verse.router, tags=["Daily Verse"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
api_router.include_router(fund_requests.router, prefix="/fund-requests", tags=["Fund Requests"])
api_router.include_router(messaging.router, prefix="/messaging", tags=["Messaging"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(user_profile.router, prefix="/user-profile", tags=["User Profile"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
