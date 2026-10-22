"""Arkesel SMS API v2 (https://sms.arkesel.com)."""
import httpx

BASE = "https://sms.arkesel.com"


class ArkeselError(Exception):
    pass


async def send(api_key: str, sender: str, recipients: list[str], message: str, callback_url: str | None = None) -> dict:
    """Returns {recipient: provider_message_id}. Raises ArkeselError on failure."""
    body = {"sender": sender, "recipients": recipients, "message": message}
    if callback_url:
        body["callback_url"] = callback_url
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(f"{BASE}/api/v2/sms/send", json=body, headers={"api-key": api_key, "Accept": "application/json"})
    except httpx.HTTPError as exc:
        raise ArkeselError(f"Could not reach Arkesel: {exc.__class__.__name__}") from exc
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 400 or data.get("status") not in ("success", "ok", True):
        raise ArkeselError(str(data.get("message") or f"Arkesel error {r.status_code}")[:300])
    ids = {}
    for row in data.get("data") or []:
        if isinstance(row, dict) and row.get("recipient"):
            ids[str(row["recipient"])] = str(row.get("id") or "")
    return ids


async def balance(api_key: str) -> dict:
    """Arkesel account balance: {'sms_balance': ..., 'main_balance': ...} (whatever Arkesel returns)."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{BASE}/api/v2/clients/balance-details", headers={"api-key": api_key, "Accept": "application/json"})
        data = r.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise ArkeselError("Could not read the Arkesel balance") from exc
    if r.status_code >= 400:
        raise ArkeselError(str(data.get("message") or f"Arkesel error {r.status_code}")[:300])
    return data.get("data") or data
