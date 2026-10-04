import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import (
    verify_password,
    create_access_token,
    get_password_hash,
    create_reset_token,
    read_reset_token,
    reset_token_matches,
    RESET_TOKEN_EXPIRE_MINUTES,
)
from app.core.email import email_enabled, send_email
from app.core.config import settings
from app.models.user import User
from app.schemas.user import Token, UserCreate, UserResponse
from app.api.v1.deps import get_current_active_user

router = APIRouter()
logger = logging.getLogger(__name__)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    # Try to find user by email or first_name (as username)
    result = await db.execute(
        select(User).where(
            (User.email == form_data.username) | 
            (User.first_name.ilike(form_data.username))
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "must_change_password": user.must_change_password if user.must_change_password is not None else False
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Change password and clear must_change_password flag"""
    # Verify current password
    if not verify_password(request.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Validate new password
    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    if request.current_password == request.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Update password and clear flag
    current_user.hashed_password = get_password_hash(request.new_password)
    current_user.must_change_password = False
    
    await db.commit()
    
    return {"message": "Password changed successfully"}


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


def _send_reset_email(to: str, first_name: str, token: str) -> None:
    link = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
    body = (
        f"Hello {first_name},\n\n"
        "We received a request to reset your Kountry Eyecare password.\n"
        f"Open this link to choose a new password (valid for {RESET_TOKEN_EXPIRE_MINUTES} minutes):\n\n"
        f"{link}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    try:
        send_email(to, "Reset your Kountry Eyecare password", body)
    except Exception:
        logger.exception("Failed to send password reset email to %s", to)


@router.post("/forgot-password")
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Email a single-use reset link. Same response whether or not the account exists."""
    if not email_enabled():
        raise HTTPException(status_code=503, detail="Password reset by email is not configured. Contact your administrator.")

    result = await db.execute(select(User).where(User.email == request.email.strip()))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        token = create_reset_token(user.id, user.hashed_password)
        # Sent after the response so timing doesn't reveal whether the account exists
        background_tasks.add_task(_send_reset_email, user.email, user.first_name, token)

    return {"message": "If the account exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    invalid = HTTPException(status_code=400, detail="This reset link is invalid or has expired")

    claims = read_reset_token(request.token)
    if not claims:
        raise invalid
    user_id, fingerprint = claims

    user = await db.get(User, int(user_id))
    if not user or not user.is_active or not reset_token_matches(fingerprint, user.hashed_password):
        raise invalid

    if len(request.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")

    user.hashed_password = get_password_hash(request.new_password)
    user.must_change_password = False
    await db.commit()

    return {"message": "Password reset successfully"}


@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists"
        )
    
    user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        phone=user_in.phone,
        role_id=user_in.role_id,
        branch_id=user_in.branch_id,
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Load relationships to avoid async lazy loading issues
    from sqlalchemy.orm import selectinload
    from app.models.user import Role
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch)
        )
        .where(User.id == user.id)
    )
    user = result.scalar_one()
    
    return user
