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
    
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
