from typing import Set
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, Role

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def load_user(db: AsyncSession, user_id: int) -> User | None:
    result = await db.execute(
        select(User)
        .options(
            selectinload(User.role).selectinload(Role.permissions),
            selectinload(User.branch),
            selectinload(User.extra_permissions),
            selectinload(User.denied_permissions),
            selectinload(User.additional_branches),
        )
        .where(User.id == user_id)
    )
    return result.scalar_one_or_none()


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    user_id = decode_token(token)
    if user_id is None:
        raise credentials_exception
    try:
        user = await load_user(db, int(user_id))
    except ValueError:
        raise credentials_exception
    if user is None:
        raise credentials_exception
    db.info["actor_id"] = user.id
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_current_superuser(
    current_user: User = Depends(get_current_active_user)
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="The user doesn't have enough privileges"
        )
    return current_user


def effective_permissions(user: User) -> Set[str]:
    """Role permissions + extra grants - denied ones."""
    codes: Set[str] = set()
    if user.role and user.role.permissions:
        codes.update(p.code for p in user.role.permissions if p.code)
    codes.update(p.code for p in (user.extra_permissions or []) if p.code)
    codes.difference_update(p.code for p in (user.denied_permissions or []) if p.code)
    return codes


def has_permission(user: User, *codes: str) -> bool:
    if user.is_superuser:
        return True
    return bool(effective_permissions(user) & set(codes))


def is_admin(user: User) -> bool:
    """Clinic admin (role named admin) or superadmin."""
    if user.is_superuser:
        return True
    return bool(user.role and (user.role.name or "").strip().lower() == "admin")


def require_permission(*codes: str):
    """Dependency: user must hold at least one of the given permission codes."""
    async def checker(current_user: User = Depends(get_current_active_user)) -> User:
        if not has_permission(current_user, *codes):
            raise HTTPException(status_code=403, detail="You don't have permission to do this")
        return current_user
    checker.required_permissions = codes  # used by the route-auth test
    return checker


async def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if not is_admin(current_user):
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


def module_gate(read: tuple[str, ...], write: tuple[str, ...] | None = None):
    """Router-level dependency. GET/HEAD need one of `read`; other methods need one of `write`.
    Superadmins always pass. Finer checks live on individual routes."""
    from fastapi import Request
    write = write if write is not None else read

    async def gate(request: Request, current_user: User = Depends(get_current_active_user)) -> User:
        if current_user.is_superuser:
            return current_user
        codes = read if request.method in ("GET", "HEAD", "OPTIONS") else write
        if codes and not has_permission(current_user, *codes):
            raise HTTPException(status_code=403, detail="You don't have permission to do this")
        return current_user
    gate.required_permissions = ("gate",) + tuple(read) + tuple(write)
    return gate
