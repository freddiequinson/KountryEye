"""Small in-memory rate limiter. Fine for the single uvicorn worker we run."""
import time
from collections import defaultdict, deque
from fastapi import HTTPException, Request

_hits: dict[str, deque] = defaultdict(deque)


def client_ip(request: Request) -> str:
    """The caller's address. X-Real-IP is only believed when the request came through one of
    our own proxies (TRUSTED_PROXIES, e.g. nginx on 127.0.0.1); anyone else could fake it."""
    from app.core.config import settings
    peer = request.client.host if request.client else "unknown"
    trusted = {p.strip() for p in (settings.TRUSTED_PROXIES or "").split(",") if p.strip()}
    if peer in trusted:
        real = (request.headers.get("x-real-ip") or "").strip()
        if real:
            return real[:64]
    return peer


def _window(key: str, window_seconds: int) -> deque:
    now = time.monotonic()
    q = _hits[key]
    while q and now - q[0] > window_seconds:
        q.popleft()
    return q


def check_rate(key: str, limit: int, window_seconds: int, record: bool = True) -> None:
    """Raise 429 once `key` has `limit` hits in the window. record=False only checks."""
    q = _window(key, window_seconds)
    if len(q) >= limit:
        raise HTTPException(status_code=429, detail="Too many attempts. Please wait a few minutes and try again.")
    if record:
        q.append(time.monotonic())


def record_hit(key: str) -> None:
    _hits[key].append(time.monotonic())


def rate_limit(name: str, limit: int, window_seconds: int):
    """Dependency: at most `limit` calls per client IP per window."""
    async def dep(request: Request) -> None:
        check_rate(f"{name}:{client_ip(request)}", limit, window_seconds)
    return dep


def reset_rate_limits() -> None:
    _hits.clear()
