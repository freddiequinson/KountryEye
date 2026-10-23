"""Field-level configuration trail. Financial records are never reverted here."""
from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from app.core.database import Base


class ChangeLog(Base):
    __tablename__ = "change_log"

    id = Column(Integer, primary_key=True)
    entity_type = Column(String(80), nullable=False, index=True)
    entity_id = Column(Integer, nullable=False, index=True)
    entity_label = Column(String(255))
    field = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    changed_by_id = Column(Integer, ForeignKey("users.id"))
    ip = Column(String(50))
    user_agent = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reverted_change_id = Column(Integer, ForeignKey("change_log.id"), unique=True)
    reversible = Column(Boolean, nullable=False, default=False)
