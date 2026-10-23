"""Phone numbers and SMS segment counting."""
import math
import re

# GSM 03.38 basic set; anything else forces Unicode (70 chars per SMS)
_GSM = set("@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà")
_GSM_EXT = set("^{}\\[~]|€")  # count as two characters


def normalize_phone(raw) -> str | None:
    """Ghana numbers to 233XXXXXXXXX. Returns None if it can't be a valid number."""
    if not raw:
        return None
    digits = re.sub(r"\D", "", str(raw))
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 10 and digits.startswith("0"):
        digits = "233" + digits[1:]
    elif len(digits) == 9:
        digits = "233" + digits
    if len(digits) == 12 and digits.startswith("233") and digits[3] in "235":
        return digits
    return None


def sms_info(text: str) -> dict:
    """Characters, encoding and how many SMS segments the text needs."""
    text = text or ""
    if all(c in _GSM or c in _GSM_EXT for c in text):
        length = sum(2 if c in _GSM_EXT else 1 for c in text)
        segments = 1 if length <= 160 else math.ceil(length / 153)
        return {"characters": length, "encoding": "GSM", "segments": max(segments, 1), "per_segment": 160 if segments <= 1 else 153}
    length = len(text)
    segments = 1 if length <= 70 else math.ceil(length / 67)
    return {"characters": length, "encoding": "Unicode", "segments": max(segments, 1), "per_segment": 70 if segments <= 1 else 67}


class _Keep(dict):
    def __missing__(self, key):
        return "{" + key + "}"


def fill(template: str, **values) -> str:
    """Fill {placeholders}; unknown ones are left as they are."""
    clean = {k: ("" if v is None else str(v)) for k, v in values.items()}
    try:
        return template.format_map(_Keep(clean)).strip()
    except (ValueError, IndexError):
        return template
