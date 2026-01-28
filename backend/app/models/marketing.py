from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Numeric, Boolean, Date
from sqlalchemy.orm import relationship

from app.core.database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    campaign_type = Column(String(50))
    start_date = Column(Date)
    end_date = Column(Date)
    budget = Column(Numeric(10, 2))
    actual_cost = Column(Numeric(10, 2))
    target_audience = Column(Text)
    goals = Column(Text)
    status = Column(String(50), default="draft")
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)

    created_by = relationship("User")
    events = relationship("Event", back_populates="campaign")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"))
    name = Column(String(200), nullable=False)
    description = Column(Text)
    event_type = Column(String(50))
    venue = Column(String(200))
    branch_id = Column(Integer, ForeignKey("branches.id"))
    start_datetime = Column(DateTime)
    end_datetime = Column(DateTime)
    expected_attendees = Column(Integer)
    actual_attendees = Column(Integer)
    budget = Column(Numeric(10, 2))
    actual_cost = Column(Numeric(10, 2))
    status = Column(String(50), default="planned")
    notes = Column(Text)
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship("Campaign", back_populates="events")
    branch = relationship("Branch")
    created_by = relationship("User")


class CustomerRating(Base):
    __tablename__ = "customer_ratings"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"))
    branch_id = Column(Integer, ForeignKey("branches.id"), nullable=False)
    visit_id = Column(Integer, ForeignKey("visits.id"))
    
    overall_rating = Column(Integer)
    service_rating = Column(Integer)
    staff_rating = Column(Integer)
    facility_rating = Column(Integer)
    wait_time_rating = Column(Integer)
    
    feedback = Column(Text)
    would_recommend = Column(Boolean)
    
    google_review_requested = Column(Boolean, default=False)
    google_review_submitted = Column(Boolean, default=False)
    
    collected_by_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient")
    branch = relationship("Branch")
    visit = relationship("Visit")
    collected_by = relationship("User")
