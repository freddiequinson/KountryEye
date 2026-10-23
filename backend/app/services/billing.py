"""Money helpers shared by the payment routes."""
from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def money(value) -> Decimal:
    """Any number -> Decimal rounded half-up to 2 places (matches the browser)."""
    if value is None or value == "":
        return Decimal("0.00")
    return Decimal(str(value)).quantize(CENT, rounding=ROUND_HALF_UP)


def visit_total(visit) -> Decimal:
    """What the visit costs in total: consultation fee plus any VAT on it."""
    return money(visit.consultation_fee) + money(getattr(visit, "vat_amount", 0))


def visit_balance(visit) -> Decimal:
    return max(visit_total(visit) - money(visit.amount_paid), Decimal("0.00"))


# Largest single payment we accept; anything bigger is a typo or tampering
MAX_PAYMENT = Decimal("10000000")


def parse_amount(raw, default: Decimal) -> Decimal:
    from fastapi import HTTPException
    if raw in (None, ""):
        return default
    try:
        value = Decimal(str(raw))
        if not value.is_finite():
            raise ValueError
        value = money(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Amount must be a number")
    if value <= 0:
        raise HTTPException(status_code=400, detail="Payment amount must be greater than 0")
    if value > MAX_PAYMENT:
        raise HTTPException(status_code=400, detail="Payment amount is too large")
    return value


async def lock_for_payment(db, obj) -> None:
    """Take the write lock on this row, then reload it.

    Two payments for the same charge then run one after the other, and the second
    sees the first one's amount instead of the old balance."""
    from sqlalchemy import update
    table = obj.__table__
    await db.execute(update(table).where(table.c.id == obj.id).values(id=obj.id))
    await db.refresh(obj)


def visit_money(visit) -> dict:
    """Money fields for a visit in API responses: fee before VAT, VAT, total, paid, balance."""
    total = visit_total(visit)
    paid = money(visit.amount_paid)
    return {
        "consultation_fee": float(money(visit.consultation_fee)),
        "vat_rate": float(visit.vat_rate) if getattr(visit, "vat_rate", None) is not None else None,
        "vat_amount": float(money(getattr(visit, "vat_amount", 0))),
        "total_amount": float(total),
        "amount_paid": float(paid),
        "balance": float(max(total - paid, Decimal("0"))),
    }
