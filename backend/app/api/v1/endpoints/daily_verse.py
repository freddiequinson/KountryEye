from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date
from pydantic import BaseModel
from typing import Optional
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_active_user
from app.models.user import User

router = APIRouter()

# Simple in-memory cache for daily verse
_verse_cache: dict = {}


class DailyVerseResponse(BaseModel):
    verse: str
    text: str
    date: str


FALLBACK_VERSES = [
    {"verse": "Jeremiah 29:11", "text": "For I know the plans I have for you, declares the LORD, plans to prosper you and not to harm you, plans to give you hope and a future."},
    {"verse": "Philippians 4:13", "text": "I can do all things through Christ who strengthens me."},
    {"verse": "Proverbs 3:5-6", "text": "Trust in the LORD with all your heart and lean not on your own understanding; in all your ways submit to him, and he will make your paths straight."},
    {"verse": "Isaiah 41:10", "text": "So do not fear, for I am with you; do not be dismayed, for I am your God. I will strengthen you and help you."},
    {"verse": "Psalm 23:1", "text": "The LORD is my shepherd, I lack nothing."},
    {"verse": "Romans 8:28", "text": "And we know that in all things God works for the good of those who love him, who have been called according to his purpose."},
    {"verse": "Matthew 11:28", "text": "Come to me, all you who are weary and burdened, and I will give you rest."},
]


def get_fallback_verse() -> dict:
    """Get a fallback verse based on day of year"""
    today = date.today()
    day_of_year = today.timetuple().tm_yday
    index = day_of_year % len(FALLBACK_VERSES)
    return FALLBACK_VERSES[index]


async def fetch_verse_from_groq() -> Optional[dict]:
    """Fetch a Bible verse from Groq API"""
    if not settings.GROQ_API_KEY:
        return None
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [
                        {
                            "role": "system",
                            "content": "You are a helpful assistant that provides Bible verses. Respond ONLY with valid JSON in this exact format: {\"verse\": \"Book Chapter:Verse\", \"text\": \"The verse text\"}. No other text."
                        },
                        {
                            "role": "user", 
                            "content": f"Give me an inspiring Bible verse for today ({date.today().strftime('%A, %B %d')}). Choose a verse about work, diligence, faith, hope, or God's provision. Make sure it's encouraging for someone starting their work day. Return ONLY the JSON."
                        }
                    ],
                    "temperature": 0.7,
                    "max_tokens": 300
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                
                # Try to parse the JSON response
                import json
                # Clean up potential markdown code blocks
                if content.startswith("```"):
                    content = content.split("```")[1]
                    if content.startswith("json"):
                        content = content[4:]
                content = content.strip()
                
                verse_data = json.loads(content)
                return {
                    "verse": verse_data.get("verse", ""),
                    "text": verse_data.get("text", "")
                }
    except Exception as e:
        print(f"Error fetching verse from Groq: {e}")
    
    return None


@router.get("/daily-verse", response_model=DailyVerseResponse)
async def get_daily_verse(
    current_user: User = Depends(get_current_active_user)
):
    """Get the daily Bible verse - fetched from Groq or fallback"""
    today_str = date.today().isoformat()
    
    # Check cache first
    if today_str in _verse_cache:
        cached = _verse_cache[today_str]
        return DailyVerseResponse(
            verse=cached["verse"],
            text=cached["text"],
            date=today_str
        )
    
    # Try to fetch from Groq
    verse_data = await fetch_verse_from_groq()
    
    if not verse_data or not verse_data.get("verse") or not verse_data.get("text"):
        # Use fallback
        verse_data = get_fallback_verse()
    
    # Cache for today
    _verse_cache[today_str] = verse_data
    
    # Clean old cache entries (keep only today)
    keys_to_remove = [k for k in _verse_cache.keys() if k != today_str]
    for k in keys_to_remove:
        del _verse_cache[k]
    
    return DailyVerseResponse(
        verse=verse_data["verse"],
        text=verse_data["text"],
        date=today_str
    )
