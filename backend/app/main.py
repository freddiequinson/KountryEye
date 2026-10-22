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
    """Make sure every permission code and default role exists (adds only, never removes)."""
    import logging
    from app.core.rbac import ensure_rbac
    async with async_session_maker() as db:
        report = await ensure_rbac(db)
    if report["permissions_added"] or report["roles_added"]:
        logging.getLogger("app.rbac").warning("RBAC sync: %s", report)


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
class PublicUploads(StaticFiles):
    """Uploaded product/asset images are public; scan results are medical records and are not."""
    async def get_response(self, path, scope):
        if path.replace("\\", "/").lstrip("/").split("/")[0] in ("scans", "private"):
            from starlette.exceptions import HTTPException as StarletteHTTPException
            raise StarletteHTTPException(status_code=404)
        return await super().get_response(path, scope)


app.mount("/uploads", PublicUploads(directory=uploads_dir), name="uploads")

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
        file_path = os.path.realpath(os.path.join(frontend_dir, full_path))
        # Never serve anything outside the frontend folder (blocks ../ tricks)
        if file_path.startswith(os.path.realpath(frontend_dir) + os.sep) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # For SPA routing, serve index.html
        index_path = os.path.join(frontend_dir, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        
        return {"detail": "Not found"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
