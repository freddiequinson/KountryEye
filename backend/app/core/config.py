from pydantic_settings import BaseSettings
from typing import List
import os
import sys


def get_database_path():
    """Get the database path - works for both dev and PyInstaller builds"""
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        base_dir = os.path.dirname(sys.executable)
    else:
        # Running in development
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    
    db_path = os.path.join(base_dir, "data", "kountry_eyecare.db")
    # Ensure data directory exists
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    return db_path


class Settings(BaseSettings):
    PROJECT_NAME: str = "Kountry Eyecare API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7
    
    DATABASE_URL: str = f"sqlite+aiosqlite:///{get_database_path()}"
    
    # AI Settings
    GROQ_API_KEY: str = ""
    AI_ENABLED: bool = False

    # Email (password reset). Leave SMTP_HOST empty to disable sending.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    SMTP_TLS: bool = True
    FRONTEND_URL: str = "http://localhost:5173"

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    # Comma-separated extra origins (deployment/.env.production uses this name)
    CORS_ORIGINS: str = ""

    # SMS (Arkesel). The API key itself is stored in the database by the superadmin.
    SMS_DRY_RUN: bool = False  # log messages instead of sending (staging/dev)
    # Public address of the site, used in links sent by SMS (e.g. http://1.2.3.4)
    PUBLIC_BASE_URL: str = ""
    # Proxies allowed to tell us the caller's address (nginx on the same box: 127.0.0.1)
    TRUSTED_PROXIES: str = ""
    SCHEDULER_ENABLED: bool = False  # run birthday/reminder jobs in this process

    class Config:
        env_file = ".env"
        case_sensitive = True


DEFAULT_SECRET = "your-secret-key-change-in-production"


def _persistent_secret() -> str:
    """Never sign tokens with the public placeholder key: keep a random one next to the DB."""
    import secrets
    path = os.path.join(os.path.dirname(get_database_path()), "secret.key")
    try:
        with open(path) as f:
            key = f.read().strip()
            if len(key) >= 32:
                return key
    except OSError:
        pass
    key = secrets.token_urlsafe(48)
    with open(path, "w") as f:
        f.write(key)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass
    return key


settings = Settings()
# Staging holds a copy of real patients: never send them real SMS from there
if "STAGING" in (settings.PROJECT_NAME or "").upper():
    settings.SMS_DRY_RUN = True
if settings.SECRET_KEY == DEFAULT_SECRET or len(settings.SECRET_KEY) < 16:
    settings.SECRET_KEY = _persistent_secret()
if settings.CORS_ORIGINS:
    settings.BACKEND_CORS_ORIGINS = list(dict.fromkeys(
        settings.BACKEND_CORS_ORIGINS + [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    ))
