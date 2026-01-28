from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.core.database import get_db
from app.core.config import settings
from app.api.v1.deps import get_current_active_user
from app.models.user import User
from app.models.settings import SystemSetting

router = APIRouter()

SYSTEM_PROMPT = """You are an AI clinical assistant for an eye care clinic (Kountry Eyecare). 
Your role is to help doctors by analyzing patient clinical data and providing:
1. A summary of the patient's condition
2. Possible differential diagnoses based on the symptoms and findings
3. Recommended additional tests or examinations
4. Treatment suggestions based on common ophthalmology practices
5. Important considerations or red flags to watch for
6. Comparison with patient's previous visits (if history is provided)
7. If a diagnosis has been made, provide your assessment of it - whether you agree, have concerns, or suggest alternatives

IMPORTANT: 
- Always remind the doctor that this is AI-assisted analysis and should be verified
- Do not make definitive diagnoses - provide possibilities for the doctor to consider
- Be concise but thorough
- Focus on eye-related conditions but consider systemic conditions that may affect the eyes
- Format your response with clear sections using markdown headers
- If patient history is available, note any progression or changes from previous visits
- If the doctor has already entered a diagnosis, include a "Diagnosis Review" section where you:
  * Confirm if the diagnosis aligns with the clinical findings
  * Highlight any findings that support or contradict the diagnosis
  * Suggest any additional considerations or alternative diagnoses if relevant
"""


async def is_ai_enabled(db: AsyncSession) -> bool:
    """Check if AI is enabled in system settings"""
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == "ai_enabled"))
    setting = result.scalar_one_or_none()
    if setting:
        return setting.value == "true"
    # Fall back to config setting
    return settings.AI_ENABLED


@router.get("/status")
async def get_ai_status(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Check if AI features are enabled"""
    enabled = await is_ai_enabled(db)
    return {
        "enabled": enabled,
        "configured": bool(settings.GROQ_API_KEY)
    }


@router.post("/analyze")
async def analyze_clinical_data(
    clinical_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Analyze clinical data and provide AI-assisted recommendations"""
    enabled = await is_ai_enabled(db)
    if not enabled:
        raise HTTPException(status_code=400, detail="AI features are disabled")
    
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="AI API key not configured")
    
    # Build the clinical summary for the AI
    patient_info = clinical_data.get("patient", {})
    clinical_record = clinical_data.get("clinical_record", {})
    patient_history = clinical_data.get("patient_history", [])
    
    # Build patient history section
    history_section = ""
    if patient_history and len(patient_history) > 0:
        history_section = "\n\n--- PATIENT VISIT HISTORY ---\n"
        for i, record in enumerate(patient_history[:5], 1):  # Limit to last 5 visits
            history_section += f"""
Visit {i} ({record.get('visit_date', 'Unknown date')}):
- Chief Complaint: {record.get('chief_complaint', 'N/A')}
- Diagnosis: {record.get('diagnosis', 'N/A')}
- VA OD/OS: {record.get('visual_acuity_od', 'N/A')} / {record.get('visual_acuity_os', 'N/A')}
- IOP OD/OS: {record.get('iop_od', 'N/A')} / {record.get('iop_os', 'N/A')}
- Management: {record.get('management_plan', 'N/A')}
"""
    else:
        history_section = "\n\n--- PATIENT VISIT HISTORY ---\nNo previous visits on record (first visit).\n"
    
    prompt = f"""
Patient Information:
- Age: {patient_info.get('age', 'Unknown')}
- Sex: {patient_info.get('sex', 'Unknown')}

Chief Complaint: {clinical_record.get('chief_complaint', 'Not provided')}

History of Present Illness: {clinical_record.get('history_of_present_illness', 'Not provided')}

Past Ocular History: {clinical_record.get('past_ocular_history', 'Not provided')}

Past Medical History: {clinical_record.get('past_medical_history', 'Not provided')}

Family History: {clinical_record.get('family_history', 'Not provided')}

Examination Findings:
- Visual Acuity OD: {clinical_record.get('visual_acuity_od', 'Not recorded')}
- Visual Acuity OS: {clinical_record.get('visual_acuity_os', 'Not recorded')}
- IOP OD: {clinical_record.get('intraocular_pressure_od', 'Not recorded')}
- IOP OS: {clinical_record.get('intraocular_pressure_os', 'Not recorded')}
- Anterior Segment OD: {clinical_record.get('anterior_segment_od', 'Not recorded')}
- Anterior Segment OS: {clinical_record.get('anterior_segment_os', 'Not recorded')}
- Posterior Segment OD: {clinical_record.get('posterior_segment_od', 'Not recorded')}
- Posterior Segment OS: {clinical_record.get('posterior_segment_os', 'Not recorded')}

Current Diagnosis (if any): {clinical_record.get('diagnosis', 'Not yet determined')}

Management Plan (if any): {clinical_record.get('management_plan', 'Not yet determined')}
{history_section}
Please analyze this clinical data and provide your assessment. If there is patient history, compare current findings with previous visits and note any progression or changes.

If a diagnosis has been entered, please include a "## Diagnosis Review" section where you evaluate whether the diagnosis is appropriate based on the clinical findings, and provide your approval or suggest alternatives/additional considerations.
"""

    try:
        async with httpx.AsyncClient() as client:
            # Use llama-3.1-8b-instant as fallback if 70b fails
            models_to_try = ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"]
            last_error = None
            
            for model in models_to_try:
                try:
                    response = await client.post(
                        "https://api.groq.com/openai/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": model,
                            "messages": [
                                {"role": "system", "content": SYSTEM_PROMPT},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.3,
                            "max_tokens": 2000
                        },
                        timeout=60.0
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        ai_response = result["choices"][0]["message"]["content"]
                        
                        return {
                            "analysis": ai_response,
                            "model": model,
                            "disclaimer": "This AI analysis is for reference only. All clinical decisions should be made by qualified healthcare professionals."
                        }
                    else:
                        last_error = f"Model {model}: {response.status_code} - {response.text}"
                        print(f"AI Model {model} failed: {last_error}")
                        continue
                except Exception as model_error:
                    last_error = f"Model {model}: {str(model_error)}"
                    print(f"AI Model {model} exception: {last_error}")
                    continue
            
            # All models failed
            raise HTTPException(
                status_code=500, 
                detail=f"AI service error: All models failed. Last error: {last_error}"
            )
            
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI service timeout")
    except Exception as e:
        import traceback
        print(f"AI Analysis Error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")
