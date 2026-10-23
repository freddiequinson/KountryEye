"""Login usernames: lower-case, 3-50 of a-z 0-9 . _ - ; unique across accounts."""
import re
from fastapi import HTTPException
from sqlalchemy import select, func

_RE = re.compile(r"^[a-z0-9._-]{3,50}$")


def normalize_username(value) -> str | None:
    """'' / None clears the username. Raises 400 on an invalid one."""
    if value is None:
        return None
    name = str(value).strip().lower()
    if not name:
        return None
    if not _RE.match(name):
        raise HTTPException(status_code=400, detail="Username must be 3-50 letters, numbers, dots, dashes or underscores")
    if "@" in name:
        raise HTTPException(status_code=400, detail="Username cannot be an email address")
    return name


async def ensure_username_free(db, username: str | None, exclude_user_id: int | None = None) -> None:
    from app.models.user import User
    if not username:
        return
    q = select(User.id).where(func.lower(User.username) == username)
    if exclude_user_id:
        q = q.where(User.id != exclude_user_id)
    if (await db.execute(q)).first():
        raise HTTPException(status_code=400, detail="That username is already taken")
