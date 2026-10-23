from datetime import datetime, timedelta
from typing import Optional, Any, Union
import hashlib
import hmac
import secrets

import jwt  # PyJWT

from app.core.config import settings


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None, version: int = 0) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject), "ver": int(version or 0)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password or len(hashed_password) <= 64:
        return False
    salt = hashed_password[:64]
    stored_hash = hashed_password[64:]
    pwdhash = hashlib.pbkdf2_hmac(
        'sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000
    )
    return hmac.compare_digest(pwdhash.hex(), stored_hash)


def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(32)
    pwdhash = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000
    )
    return salt + pwdhash.hex()


def decode_access_token(token: str) -> Optional[dict]:
    """Claims of a valid login token, or None. Reset links and other purpose tokens never count."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") or not payload.get("sub"):
        return None
    return payload


def decode_token(token: str) -> Optional[str]:
    payload = decode_access_token(token)
    return payload.get("sub") if payload else None


def token_is_current(payload: dict, user) -> bool:
    """False once the password changed or the account was switched off after this token was issued."""
    return int(payload.get("ver", 0) or 0) == int(getattr(user, "token_version", 0) or 0)


RESET_PURPOSE = "pwd_reset"
RESET_TOKEN_EXPIRE_MINUTES = 30


def _password_fingerprint(hashed_password: str) -> str:
    # Changes whenever the password changes, so a reset token works only once
    return hashed_password[-16:]


def create_reset_token(user_id: int, hashed_password: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "sub": str(user_id),
        "purpose": RESET_PURPOSE,
        "fp": _password_fingerprint(hashed_password),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def read_reset_token(token: str) -> Optional[tuple[str, str]]:
    """Returns (user_id, fingerprint) for a valid, unexpired reset token, else None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != RESET_PURPOSE or not payload.get("sub") or not payload.get("fp"):
        return None
    return payload["sub"], payload["fp"]


def reset_token_matches(fingerprint: str, hashed_password: str) -> bool:
    return hmac.compare_digest(fingerprint, _password_fingerprint(hashed_password))
