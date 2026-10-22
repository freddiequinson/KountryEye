"""SMS: message log, campaigns, contact groups, shop credit ledger, public receipt links."""
from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text

from app.core.database import Base


class SmsMessage(Base):
    __tablename__ = "sms_messages"

    id = Column(Integer, primary_key=True)
    recipient = Column(String(20), nullable=False, index=True)  # 233XXXXXXXXX
    recipient_name = Column(String(200))
    patient_id = Column(Integer, ForeignKey("patients.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"))  # staff recipient (birthdays)
    body = Column(Text, nullable=False)
    # receipt | lab | birthday | review | debt | promo | manual
    category = Column(String(20), nullable=False, index=True)
    # queued | sent | delivered | failed | blocked | dry_run
    status = Column(String(20), nullable=False, default="queued", index=True)
    segments = Column(Integer, nullable=False, default=1)
    provider_cost = Column(Numeric(10, 4), default=0)  # what Arkesel charges us
    shop_cost = Column(Numeric(10, 4), default=0)  # what the shop is billed
    provider_id = Column(String(100), index=True)
    error = Column(String(500))
    entity_type = Column(String(40))
    entity_id = Column(Integer)
    campaign_id = Column(Integer, ForeignKey("sms_campaigns.id"), index=True)
    sent_by_id = Column(Integer, ForeignKey("users.id"))
    # Stops the same automatic message going out twice (e.g. one birthday SMS a year)
    dedupe_key = Column(String(120), unique=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)


class SmsCampaign(Base):
    __tablename__ = "sms_campaigns"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    audience = Column(Text, nullable=False)  # JSON: filters / group_id / numbers
    # draft | scheduled | sending | sent | cancelled
    status = Column(String(20), nullable=False, default="scheduled", index=True)
    scheduled_at = Column(DateTime)
    recipients = Column(Integer, default=0)
    sent = Column(Integer, default=0)
    failed = Column(Integer, default=0)
    shop_cost = Column(Numeric(10, 4), default=0)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    finished_at = Column(DateTime)


class ContactGroup(Base):
    __tablename__ = "contact_groups"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, unique=True)
    description = Column(String(255))
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)


class ContactGroupMember(Base):
    __tablename__ = "contact_group_members"

    id = Column(Integer, primary_key=True)
    group_id = Column(Integer, ForeignKey("contact_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    phone = Column(String(20), nullable=False)
    name = Column(String(200))


class SmsCreditEntry(Base):
    """Shop SMS wallet. Top-ups are positive, sends negative. Balance = sum(amount)."""
    __tablename__ = "sms_credit_ledger"

    id = Column(Integer, primary_key=True)
    kind = Column(String(20), nullable=False)  # topup | send | adjustment
    amount = Column(Numeric(12, 4), nullable=False)
    message_id = Column(Integer, ForeignKey("sms_messages.id"))
    note = Column(String(255))
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ReceiptLink(Base):
    """Unguessable short link to a receipt PDF, sent by SMS."""
    __tablename__ = "receipt_links"

    token = Column(String(24), primary_key=True)
    kind = Column(String(20), nullable=False)  # visit | prescription | sale
    ref_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    opened_count = Column(Integer, default=0)
