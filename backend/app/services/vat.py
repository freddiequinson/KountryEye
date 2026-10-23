"""VAT: one rate set by the admin, added on top of every entered (VAT-exclusive) price."""
from decimal import Decimal

from sqlalchemy import select

from app.services.billing import money


async def get_vat_rate(db) -> Decimal:
    """VAT percentage from the 'vat_rate' setting; 0 when unset or invalid."""
    from app.models.settings import SystemSetting
    value = (await db.execute(select(SystemSetting.value).where(SystemSetting.key == "vat_rate"))).scalar_one_or_none()
    try:
        rate = Decimal(str(value or 0))
    except Exception:
        return Decimal("0")
    return rate if Decimal("0") <= rate <= Decimal("100") else Decimal("0")


def vat_on(net, rate) -> Decimal:
    """VAT on a VAT-exclusive amount, rounded half-up to the pesewa."""
    return money(money(net) * Decimal(str(rate or 0)) / 100)


def vat_share(paid, vat, gross) -> Decimal:
    """How much of a (part) payment is VAT, in proportion to the bill."""
    gross = money(gross)
    if gross <= 0:
        return Decimal("0.00")
    return money(money(paid) * money(vat) / gross)
