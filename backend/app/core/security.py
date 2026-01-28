from datetime import datetime, timedelta
from typing import Optional, Any, Union
import hashlib
import secrets

from jose import jwt

from app.core.config import settings


def create_access_token(subject: Union[str, Any], expires_delta: timedelta = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    salt = hashed_password[:64]
    stored_hash = hashed_password[64:]
    pwdhash = hashlib.pbkdf2_hmac(
        'sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000
    )
    return pwdhash.hex() == stored_hash


def get_password_hash(password: str) -> str:
    salt = secrets.token_hex(32)
    pwdhash = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000
    )
    return salt + pwdhash.hex()


def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload.get("sub")
    except jwt.JWTError:
        return None
