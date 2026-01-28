from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime

from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(Integer)
    
    old_values = Column(Text)
    new_values = Column(Text)
    
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)
