import logging
from datetime import timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
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
from app.api.v1.deps import get_current_active_user, get_current_superuser
from app.core.ratelimit import rate_limit, check_rate, record_hit, client_ip

router = APIRouter()
logger = logging.getLogger(__name__)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    username = (form_data.username or "").strip()
    bad_login = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Incorrect email/username or password",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not username or not form_data.password:
        raise bad_login
    # Only failed attempts count: 20 per IP per 5 minutes, 10 per account per 15 minutes
    ip_key, user_key = f"login-fail-ip:{client_ip(request)}", f"login-fail-user:{username.lower()}"
    check_rate(ip_key, 20, 300, record=False)
    check_rate(user_key, 10, 900, record=False)

    # Username or email (case-insensitive, exact). Accounts without a username can still
    # use their first name, as before. No wildcards.
    name = username.lower()
    result = await db.execute(
        select(User).where((func.lower(User.username) == name) | (func.lower(User.email) == name))
    )
    candidates = result.scalars().all()
    if not candidates:
        result = await db.execute(
            select(User).where(User.username.is_(None), func.lower(User.first_name) == name)
        )
        candidates = result.scalars().all()
    # Several staff can share a first name: accept whichever account the password matches
    user = next((u for u in candidates if verify_password(form_data.password, u.hashed_password)), None)
    if not user:
        record_hit(ip_key)
        record_hit(user_key)
        raise bad_login

    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    from datetime import datetime
    user.last_login = datetime.utcnow()
    await db.commit()

    access_token = create_access_token(subject=user.id, version=user.token_version)
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
    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    
    if request.current_password == request.new_password:
        raise HTTPException(status_code=400, detail="New password must be different from current password")
    
    # Update password and clear flag
    current_user.hashed_password = get_password_hash(request.new_password)
    current_user.must_change_password = False

    await db.commit()  # signs the account out everywhere (token version goes up)
    await db.refresh(current_user)

    # A fresh login for this browser, so changing your password doesn't log you out here
    return {"message": "Password changed successfully",
            "access_token": create_access_token(subject=current_user.id, version=current_user.token_version),
            "token_type": "bearer"}


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


@router.post("/forgot-password", dependencies=[Depends(rate_limit("forgot", 5, 900))])
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Email a single-use reset link. Same response whether or not the account exists."""
    if not email_enabled():
        raise HTTPException(status_code=503, detail="Password reset by email is not configured. Contact your administrator.")

    result = await db.execute(select(User).where(func.lower(User.email) == request.email.strip().lower()))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        token = create_reset_token(user.id, user.hashed_password)
        # Sent after the response so timing doesn't reveal whether the account exists
        background_tasks.add_task(_send_reset_email, user.email, user.first_name, token)

    return {"message": "If the account exists, a reset link has been sent"}


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset", 10, 900))])
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

    if len(request.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")

    user.hashed_password = get_password_hash(request.new_password)
    user.must_change_password = False
    await db.commit()

    return {"message": "Password reset successfully"}


@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_superuser),
):
    """Create an account. Superadmin only; staff are normally added from Employees."""
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists"
        )
    
    from app.core.usernames import normalize_username, ensure_username_free
    username = normalize_username(user_in.username)
    await ensure_username_free(db, username)
    user = User(
        email=user_in.email,
        username=username,
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
