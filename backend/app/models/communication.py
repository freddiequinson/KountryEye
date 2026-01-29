from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Numeric, Enum
from sqlalchemy.orm import relationship
import enum

from app.core.database import Base


# ============ FUND REQUEST / MEMO SYSTEM ============

class FundRequestStatus(str, enum.Enum):
    pending = "pending"           # Employee submitted, waiting for admin review
    approved = "approved"         # Admin approved the request
    rejected = "rejected"         # Admin rejected the request
    disbursed = "disbursed"       # Admin has sent the money
    received = "received"         # Employee confirmed receipt
    cancelled = "cancelled"       # Request was cancelled


class FundRequest(Base):
    """Fund/Money request from employees to admin"""
    __tablename__ = "fund_requests"

    id = Column(Integer, primary_key=True, index=True)
    
    # Request details
    title = Column(String(255), nullable=False)
    description = Column(Text)
    amount = Column(Numeric(10, 2), nullable=False)
    purpose = Column(String(100))  # e.g., "supplies", "transport", "equipment", "other"
    
    # Status workflow
    status = Column(String(20), default="pending")
    
    # Requester info
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    branch_id = Column(Integer, ForeignKey("branches.id"))
    
    # Admin actions
    reviewed_by_id = Column(Integer, ForeignKey("users.id"))
    reviewed_at = Column(DateTime)
    review_notes = Column(Text)
    
    # Disbursement
    disbursed_at = Column(DateTime)
    disbursement_method = Column(String(50))  # cash, transfer, momo
    disbursement_reference = Column(String(100))
    
    # Receipt confirmation
    received_at = Column(DateTime)
    receipt_notes = Column(Text)
    
    # Link to expense (created when received)
    expense_id = Column(Integer, ForeignKey("expenses.id"))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    requested_by = relationship("User", foreign_keys=[requested_by_id], backref="fund_requests")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_id])
    branch = relationship("Branch")
    expense = relationship("Expense")


# ============ MESSAGING SYSTEM ============

class Conversation(Base):
    """Chat conversation between users"""
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    
    # For direct messages (1-on-1)
    is_group = Column(Boolean, default=False)
    name = Column(String(255))  # For group chats
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class ConversationParticipant(Base):
    """Participants in a conversation"""
    __tablename__ = "conversation_participants"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Track read status
    last_read_at = Column(DateTime)
    is_typing = Column(Boolean, default=False)
    typing_updated_at = Column(DateTime)
    
    # Notification preferences
    is_muted = Column(Boolean, default=False)
    
    joined_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User", backref="conversation_participations")


class MessageType(str, enum.Enum):
    text = "text"
    fund_request = "fund_request"  # Attached fund request
    product = "product"            # Referenced product
    system = "system"              # System message


class Message(Base):
    """Individual message in a conversation"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Message content
    content = Column(Text, nullable=False)
    message_type = Column(String(20), default="text")
    
    # Reply to another message
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    
    # Attachments/References
    fund_request_id = Column(Integer, ForeignKey("fund_requests.id"))
    product_id = Column(Integer, ForeignKey("products.id"))
    
    # Status
    is_edited = Column(Boolean, default=False)
    edited_at = Column(DateTime)
    is_deleted = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", backref="sent_messages")
    fund_request = relationship("FundRequest")
    product = relationship("Product")
    reply_to = relationship("Message", remote_side=[id], backref="replies")
    read_receipts = relationship("MessageReadReceipt", back_populates="message", cascade="all, delete-orphan")


class MessageReadReceipt(Base):
    """Track message delivery and read status per user"""
    __tablename__ = "message_read_receipts"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    delivered_at = Column(DateTime)
    read_at = Column(DateTime)
    
    # Relationships
    message = relationship("Message", back_populates="read_receipts")
    user = relationship("User")

    __table_args__ = (
        # Unique constraint: one receipt per message per user
        {'sqlite_autoincrement': True},
    )


# ============ NOTIFICATION SYSTEM ============

class NotificationType(str, enum.Enum):
    fund_request = "fund_request"
    fund_approved = "fund_approved"
    fund_rejected = "fund_rejected"
    fund_disbursed = "fund_disbursed"
    fund_received = "fund_received"
    message = "message"
    task = "task"
    system = "system"
    reminder = "reminder"


class Notification(Base):
    """In-app notifications for users"""
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Notification content
    title = Column(String(255), nullable=False)
    message = Column(Text)
    notification_type = Column(String(50), default="system")
    
    # Reference to related entity
    reference_type = Column(String(50))  # "fund_request", "message", "conversation", etc.
    reference_id = Column(Integer)
    
    # Action URL (where to navigate when clicked)
    action_url = Column(String(255))
    
    # Status
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="notifications")
