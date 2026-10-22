"""Capture changes in the same transaction as the write, including legacy routes.

Only explicitly listed configuration fields support revert. Secrets are redacted,
passwords are excluded, and deleted/created entities cannot be restored by revert.
"""
import json
from decimal import Decimal
from sqlalchemy import event, inspect, Numeric
from sqlalchemy.orm import Session
from app.models.change_log import ChangeLog

# Table name -> tracked scalar fields. Collection grants are handled separately.
TRACKED = {
    "system_settings": ("value",),
    "roles": ("name", "description", "default_page", "admin_may_assign"),
    "users": ("role_id", "branch_id", "is_active", "is_superuser", "username"),
    "products": ("unit_price", "cost_price"),
    "consultation_types": ("base_fee", "initial_fee", "review_fee", "subsequent_fee", "is_active"),
    "visit_fee_settings": ("initial_visit_fee", "review_visit_fee", "subsequent_visit_fee", "review_period_days"),
    "insurance_fee_overrides": ("override_fee", "initial_fee", "review_fee", "subsequent_fee"),
    "insurance_companies": ("name", "code", "is_active"),
    "branches": ("name", "address", "phone", "email", "is_active"),
}
COLLECTIONS = {"roles": ("permissions",), "users": ("extra_permissions", "denied_permissions", "additional_branches")}
PAYMENT_TABLES = {"payments", "invoice_payments", "revenues", "scan_payments", "referral_payments"}


def encode(value):
    if isinstance(value, Decimal):
        value = format(value.normalize(), "f")
    return json.dumps(value, sort_keys=True, default=str)


def secret_setting(key):
    return key.startswith(("secret.", "sms.api_key", "sms.webhook_token"))


def record_change(session, obj, field, old, new, *, reversible=False, deleted=False):
    """Queue a field change; the flush assigns new entity IDs before logging it."""
    if encode(old) == encode(new):
        return
    secret = obj.__tablename__ == "system_settings" and secret_setting(obj.key)
    if secret:
        old, new, reversible = "[redacted]", "[redacted]", False
    session.info.setdefault("pending_changes", []).append(
        (obj, field, encode(old), encode(new), reversible and not deleted)
    )


@event.listens_for(Session, "before_flush")
def capture_changes(session, flush_context, instances):
    if "actor_id" not in session.info:
        return
    for obj in set(session.new) | set(session.dirty) | set(session.deleted):
        table = getattr(obj, "__tablename__", "")
        state = inspect(obj)
        created, deleted = obj in session.new, obj in session.deleted
        for field in TRACKED.get(table, ()):
            attr = state.attrs[field]
            if not created and not deleted and not attr.history.has_changes():
                continue
            old = None if created else (attr.history.deleted[0] if attr.history.deleted else getattr(obj, field))
            new = None if deleted else getattr(obj, field)
            if isinstance(state.mapper.columns[field].type, Numeric):
                old = Decimal(str(old)) if old is not None else None
                new = Decimal(str(new)) if new is not None else None
            # Unknown prior values must never become revert candidates.
            reversible = not created and not deleted and bool(attr.history.deleted)
            record_change(session, obj, field, old, new, reversible=reversible, deleted=deleted)
        for field in COLLECTIONS.get(table, ()):
            attr = state.attrs[field]
            if not attr.history.has_changes():
                continue
            new = sorted(x.id for x in getattr(obj, field))
            old = sorted({x.id for x in attr.history.unchanged} | {x.id for x in attr.history.deleted})
            record_change(session, obj, field, old, new, reversible=not created and not deleted)
        # Extend the existing audit trail to payments, refunds and deletions.
        if deleted or (table in PAYMENT_TABLES and (created or session.is_modified(obj, include_collections=False))):
            session.info.setdefault("pending_audits", []).append((obj, "delete" if deleted else "payment"))
        elif table in ("sales", "invoices", "prescriptions", "visits"):
            for field in ("amount_paid", "payment_status", "status"):
                if field in state.attrs and state.attrs[field].history.has_changes():
                    session.info.setdefault("pending_audits", []).append((obj, "payment_update"))
                    break


@event.listens_for(Session, "after_flush_postexec")
def write_changes(session, flush_context):
    from app.models.audit import AuditLog
    for obj, field, old, new, reversible in session.info.pop("pending_changes", []):
        session.add(ChangeLog(
            entity_type=obj.__tablename__, entity_id=obj.id, field=field,
            entity_label=str(next((getattr(obj, name) for name in ("key", "name", "email") if hasattr(obj, name)), f"#{obj.id}"))[:255],
            old_value=old, new_value=new, changed_by_id=session.info["actor_id"],
            ip=session.info.get("ip"), user_agent=session.info.get("user_agent"),
            reversible=reversible, reverted_change_id=session.info.get("reverting_change_id"),
        ))
    for obj, action in session.info.pop("pending_audits", []):
        session.add(AuditLog(
            user_id=session.info["actor_id"], action=action, entity_type=obj.__tablename__, entity_id=obj.id,
            ip_address=session.info.get("ip"), user_agent=session.info.get("user_agent"),
            new_values=encode({field: getattr(obj, field) for field in ("amount", "amount_paid", "payment_status", "status") if field in inspect(obj).attrs}),
        ))


@event.listens_for(Session, "after_rollback")
def discard_pending(session):
    for key in ("pending_changes", "pending_audits", "reverting_change_id"):
        session.info.pop(key, None)
