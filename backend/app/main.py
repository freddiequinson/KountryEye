from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
import sys

from app.core.config import settings


def get_base_path():
    """Get the base path for the application (works for both dev and PyInstaller)"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


from app.core.database import init_db, async_session_maker
from app.api.v1.router import api_router


async def seed_permissions_on_startup():
    """Seed default permissions and roles with their default permissions"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.user import Permission, Role
    
    DEFAULT_PERMISSIONS = [
        {"name": "View Dashboard", "code": "dashboard.view", "module": "dashboard"},
        {"name": "View Admin Dashboard", "code": "dashboard.admin", "module": "dashboard"},
        {"name": "View Doctor Dashboard", "code": "dashboard.doctor", "module": "dashboard"},
        {"name": "View Front Desk Dashboard", "code": "dashboard.frontdesk", "module": "dashboard"},
        {"name": "View Marketing Dashboard", "code": "dashboard.marketing", "module": "dashboard"},
        {"name": "View Patients", "code": "patients.view", "module": "patients"},
        {"name": "Create Patients", "code": "patients.create", "module": "patients"},
        {"name": "Edit Patients", "code": "patients.edit", "module": "patients"},
        {"name": "Delete Patients", "code": "patients.delete", "module": "patients"},
        {"name": "View Visits", "code": "visits.view", "module": "visits"},
        {"name": "Create Visits", "code": "visits.create", "module": "visits"},
        {"name": "Check-in Patients", "code": "visits.checkin", "module": "visits"},
        {"name": "View Consultations", "code": "clinical.view", "module": "clinical"},
        {"name": "Create Consultations", "code": "clinical.create", "module": "clinical"},
        {"name": "View Prescriptions", "code": "prescriptions.view", "module": "clinical"},
        {"name": "Create Prescriptions", "code": "prescriptions.create", "module": "clinical"},
        {"name": "Access Doctor Queue", "code": "clinical.queue", "module": "clinical"},
        {"name": "Access POS", "code": "pos.access", "module": "sales"},
        {"name": "View Sales", "code": "sales.view", "module": "sales"},
        {"name": "Create Sales", "code": "sales.create", "module": "sales"},
        {"name": "Apply Discounts", "code": "sales.discount", "module": "sales"},
        {"name": "Process Refunds", "code": "sales.refund", "module": "sales"},
        {"name": "View Payments", "code": "payments.view", "module": "payments"},
        {"name": "Process Payments", "code": "payments.create", "module": "payments"},
        {"name": "Generate Receipts", "code": "receipts.generate", "module": "payments"},
        {"name": "View Inventory", "code": "inventory.view", "module": "inventory"},
        {"name": "Manage Inventory", "code": "inventory.manage", "module": "inventory"},
        {"name": "View Assets", "code": "assets.view", "module": "assets"},
        {"name": "Manage Assets", "code": "assets.manage", "module": "assets"},
        {"name": "View Marketing", "code": "marketing.view", "module": "marketing"},
        {"name": "Manage Campaigns", "code": "marketing.manage", "module": "marketing"},
        {"name": "View Accounting", "code": "accounting.view", "module": "accounting"},
        {"name": "Manage Accounting", "code": "accounting.manage", "module": "accounting"},
        {"name": "View Revenue", "code": "revenue.view", "module": "revenue"},
        {"name": "View Employees", "code": "employees.view", "module": "employees"},
        {"name": "Manage Employees", "code": "employees.manage", "module": "employees"},
        {"name": "Manage Branches", "code": "branches.manage", "module": "branches"},
        {"name": "Manage Permissions", "code": "permissions.manage", "module": "permissions"},
    ]
    
    # Default permissions per role
    ROLE_PERMISSIONS = {
        "admin": ["*"],  # All permissions
        "doctor": [
            "dashboard.view", "dashboard.doctor", "patients.view", "patients.edit",
            "visits.view", "clinical.view", "clinical.create", "clinical.queue",
            "prescriptions.view", "prescriptions.create"
        ],
        "frontdesk": [
            "dashboard.view", "dashboard.frontdesk", "patients.view", "patients.create",
            "patients.edit", "visits.view", "visits.create", "visits.checkin",
            "pos.access", "sales.view", "sales.create", "payments.view", "payments.create",
            "receipts.generate"
        ],
        "marketing": [
            "dashboard.view", "dashboard.marketing", "patients.view",
            "marketing.view", "marketing.manage"
        ],
    }
    
    async with async_session_maker() as db:
        # Get all permissions
        result = await db.execute(select(Permission))
        all_permissions = {p.code: p for p in result.scalars().all()}
        
        # Get all roles with their permissions
        result = await db.execute(select(Role).options(selectinload(Role.permissions)))
        roles = {r.name.lower(): r for r in result.scalars().all()}
        
        # Assign permissions to roles if they have none
        for role_name, perm_codes in ROLE_PERMISSIONS.items():
            if role_name in roles:
                role = roles[role_name]
                if len(role.permissions) == 0:  # Only assign if role has no permissions
                    if perm_codes == ["*"]:
                        # Admin gets all permissions
                        role.permissions = list(all_permissions.values())
                    else:
                        role.permissions = [all_permissions[code] for code in perm_codes if code in all_permissions]
                    print(f"Assigned {len(role.permissions)} permissions to {role_name}")
        
        await db.commit()
        print("Role permissions assigned successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_permissions_on_startup()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    redirect_slashes=False
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Get base path for file locations
base_path = get_base_path()

# Serve uploaded files - must be mounted before API router
uploads_dir = os.path.join(base_path, "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve frontend static files in production
frontend_dir = os.path.join(base_path, "frontend")
if os.path.exists(frontend_dir):
    # Mount assets directory
    assets_dir = os.path.join(frontend_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_frontend(request: Request, full_path: str):
        """Serve frontend files - this must be the last route"""
        # Don't serve frontend for API routes
        if full_path.startswith("api/") or full_path.startswith("uploads/"):
            return {"detail": "Not found"}
        
        # Try to serve the exact file
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # For SPA routing, serve index.html
        index_path = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        return {"detail": "Not found"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
