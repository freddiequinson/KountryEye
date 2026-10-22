"""Safe file uploads: check the real file type, cap the size, and use random names."""
import os
import uuid
from fastapi import HTTPException, UploadFile

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PUBLIC_DIR = os.path.join(BACKEND_DIR, "uploads")           # served at /uploads
PRIVATE_DIR = os.path.join(BACKEND_DIR, "data", "private")  # never served directly

# signature -> (kind, extension)
_SIGNATURES = [
    (b"\xff\xd8\xff", "image", "jpg"),
    (b"\x89PNG\r\n\x1a\n", "image", "png"),
    (b"GIF87a", "image", "gif"),
    (b"GIF89a", "image", "gif"),
    (b"%PDF-", "pdf", "pdf"),
]


def sniff(content: bytes) -> tuple[str, str] | None:
    for sig, kind, ext in _SIGNATURES:
        if content.startswith(sig):
            return kind, ext
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image", "webp"
    return None


async def save_upload(
    file: UploadFile,
    subdir: str,
    kinds: tuple[str, ...] = ("image",),
    max_mb: int = 5,
    private: bool = False,
    prefix: str = "",
) -> tuple[str, str]:
    """Validate and store an upload. Returns (absolute_path, public_url_or_empty)."""
    content = await file.read(max_mb * 1024 * 1024 + 1)
    if not content:
        raise HTTPException(status_code=400, detail="The file is empty")
    if len(content) > max_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {max_mb}MB")
    found = sniff(content)
    if not found or found[0] not in kinds:
        allowed = " or ".join("JPEG, PNG, GIF, WebP image" if k == "image" else "PDF" for k in kinds)
        raise HTTPException(status_code=400, detail=f"Unsupported file. Please upload a {allowed}.")
    root = PRIVATE_DIR if private else PUBLIC_DIR
    folder = os.path.join(root, subdir)
    os.makedirs(folder, exist_ok=True)
    safe_prefix = "".join(ch for ch in prefix if ch.isalnum() or ch in "-_")[:40]
    name = f"{safe_prefix + '_' if safe_prefix else ''}{uuid.uuid4().hex}.{found[1]}"
    path = os.path.join(folder, name)
    with open(path, "wb") as f:
        f.write(content)
    url = "" if private else f"/uploads/{subdir}/{name}"
    return path, url
