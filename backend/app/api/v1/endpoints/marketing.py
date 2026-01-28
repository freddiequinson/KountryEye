from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.marketing import Campaign, Event, CustomerRating
from app.schemas.marketing import (
    CampaignCreate, CampaignUpdate, CampaignResponse,
    EventCreate, EventUpdate, EventResponse,
    CustomerRatingCreate, CustomerRatingResponse
)

router = APIRouter()


@router.get("/campaigns", response_model=List[CampaignResponse])
async def get_campaigns(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Campaign)
    if status:
        query = query.where(Campaign.status == status)
    
    result = await db.execute(query.order_by(Campaign.created_at.desc()))
    return result.scalars().all()


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign


@router.post("/campaigns", response_model=CampaignResponse)
async def create_campaign(
    campaign_in: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    campaign = Campaign(**campaign_in.model_dump(), created_by_id=current_user.id)
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
async def update_campaign(
    campaign_id: int,
    campaign_in: CampaignUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    for field, value in campaign_in.model_dump(exclude_unset=True).items():
        setattr(campaign, field, value)
    
    await db.commit()
    await db.refresh(campaign)
    return campaign


@router.get("/events", response_model=List[EventResponse])
async def get_events(
    campaign_id: Optional[int] = None,
    branch_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(Event)
    if campaign_id:
        query = query.where(Event.campaign_id == campaign_id)
    if branch_id:
        query = query.where(Event.branch_id == branch_id)
    if status:
        query = query.where(Event.status == status)
    
    result = await db.execute(query.order_by(Event.start_datetime.desc()))
    return result.scalars().all()


@router.post("/events", response_model=EventResponse)
async def create_event(
    event_in: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    event = Event(**event_in.model_dump(), created_by_id=current_user.id)
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


@router.put("/events/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: int,
    event_in: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    for field, value in event_in.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    
    await db.commit()
    await db.refresh(event)
    return event


@router.get("/ratings", response_model=List[CustomerRatingResponse])
async def get_ratings(
    branch_id: Optional[int] = None,
    min_rating: Optional[int] = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = select(CustomerRating)
    if branch_id:
        query = query.where(CustomerRating.branch_id == branch_id)
    if min_rating:
        query = query.where(CustomerRating.overall_rating >= min_rating)
    
    query = query.order_by(CustomerRating.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/ratings", response_model=CustomerRatingResponse)
async def create_rating(
    rating_in: CustomerRatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    rating = CustomerRating(**rating_in.model_dump(), collected_by_id=current_user.id)
    db.add(rating)
    await db.commit()
    await db.refresh(rating)
    return rating


@router.put("/ratings/{rating_id}/google-review")
async def request_google_review(
    rating_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    result = await db.execute(select(CustomerRating).where(CustomerRating.id == rating_id))
    rating = result.scalar_one_or_none()
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")
    
    rating.google_review_requested = True
    await db.commit()
    
    return {
        "message": "Google review requested",
        "review_url": "https://g.page/r/YOUR_GOOGLE_BUSINESS_ID/review"
    }


@router.get("/analytics")
async def get_marketing_analytics(
    branch_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    ratings_query = select(CustomerRating)
    if branch_id:
        ratings_query = ratings_query.where(CustomerRating.branch_id == branch_id)
    
    ratings_result = await db.execute(ratings_query)
    ratings = ratings_result.scalars().all()
    
    total_ratings = len(ratings)
    if total_ratings == 0:
        return {
            "total_ratings": 0,
            "average_overall": 0,
            "average_service": 0,
            "average_staff": 0,
            "average_facility": 0,
            "average_wait_time": 0,
            "recommendation_rate": 0,
            "google_reviews_requested": 0,
            "google_reviews_submitted": 0
        }
    
    avg_overall = sum(r.overall_rating or 0 for r in ratings) / total_ratings
    avg_service = sum(r.service_rating or 0 for r in ratings) / total_ratings
    avg_staff = sum(r.staff_rating or 0 for r in ratings) / total_ratings
    avg_facility = sum(r.facility_rating or 0 for r in ratings) / total_ratings
    avg_wait = sum(r.wait_time_rating or 0 for r in ratings) / total_ratings
    
    would_recommend = sum(1 for r in ratings if r.would_recommend)
    google_requested = sum(1 for r in ratings if r.google_review_requested)
    google_submitted = sum(1 for r in ratings if r.google_review_submitted)
    
    return {
        "total_ratings": total_ratings,
        "average_overall": round(avg_overall, 2),
        "average_service": round(avg_service, 2),
        "average_staff": round(avg_staff, 2),
        "average_facility": round(avg_facility, 2),
        "average_wait_time": round(avg_wait, 2),
        "recommendation_rate": round(would_recommend / total_ratings * 100, 1),
        "google_reviews_requested": google_requested,
        "google_reviews_submitted": google_submitted
    }
