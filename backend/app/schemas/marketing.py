from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class CampaignBase(BaseModel):
    name: str
    description: Optional[str] = None
    campaign_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = None
    target_audience: Optional[str] = None
    goals: Optional[str] = None


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    campaign_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = None
    actual_cost: Optional[float] = None
    target_audience: Optional[str] = None
    goals: Optional[str] = None
    status: Optional[str] = None


class CampaignResponse(CampaignBase):
    id: int
    actual_cost: Optional[float] = None
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    name: str
    description: Optional[str] = None
    event_type: Optional[str] = None
    venue: Optional[str] = None
    branch_id: Optional[int] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    expected_attendees: Optional[int] = None
    budget: Optional[float] = None
    notes: Optional[str] = None


class EventCreate(EventBase):
    campaign_id: Optional[int] = None


class EventUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    venue: Optional[str] = None
    start_datetime: Optional[datetime] = None
    end_datetime: Optional[datetime] = None
    expected_attendees: Optional[int] = None
    actual_attendees: Optional[int] = None
    budget: Optional[float] = None
    actual_cost: Optional[float] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class EventResponse(EventBase):
    id: int
    campaign_id: Optional[int] = None
    actual_attendees: Optional[int] = None
    actual_cost: Optional[float] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class CustomerRatingBase(BaseModel):
    overall_rating: Optional[int] = None
    service_rating: Optional[int] = None
    staff_rating: Optional[int] = None
    facility_rating: Optional[int] = None
    wait_time_rating: Optional[int] = None
    feedback: Optional[str] = None
    would_recommend: Optional[bool] = None


class CustomerRatingCreate(CustomerRatingBase):
    patient_id: Optional[int] = None
    branch_id: int
    visit_id: Optional[int] = None


class CustomerRatingResponse(CustomerRatingBase):
    id: int
    patient_id: Optional[int] = None
    branch_id: int
    visit_id: Optional[int] = None
    google_review_requested: bool
    google_review_submitted: bool
    created_at: datetime

    class Config:
        from_attributes = True
