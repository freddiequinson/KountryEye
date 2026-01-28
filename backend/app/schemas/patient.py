from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.models.patient import Sex, MaritalStatus, VisitType


class PatientBase(BaseModel):
    first_name: str
    last_name: str
    other_names: Optional[str] = None
    date_of_birth: Optional[date] = None
    sex: Optional[Sex] = None
    marital_status: Optional[MaritalStatus] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    occupation: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientCreate(PatientBase):
    branch_id: int


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    other_names: Optional[str] = None
    date_of_birth: Optional[date] = None
    sex: Optional[Sex] = None
    marital_status: Optional[MaritalStatus] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    occupation: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None


class PatientResponse(PatientBase):
    id: int
    patient_number: str
    branch_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PatientSearch(BaseModel):
    query: Optional[str] = None
    branch_id: Optional[int] = None
    phone: Optional[str] = None
    patient_number: Optional[str] = None


class VisitBase(BaseModel):
    visit_type: VisitType
    reason: Optional[str] = None
    notes: Optional[str] = None


class VisitCreate(VisitBase):
    patient_id: int
    consultation_type_id: Optional[int] = None
    payment_type: Optional[str] = "cash"  # cash, insurance, visioncare
    insurance_provider: Optional[str] = None
    insurance_id: Optional[str] = None
    insurance_number: Optional[str] = None
    insurance_limit: Optional[float] = None  # Maximum amount insurance will cover


class VisitUpdate(BaseModel):
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class VisitResponse(VisitBase):
    id: int
    visit_number: Optional[str] = None
    patient_id: int
    branch_id: int
    recorded_by_id: int
    status: str
    consultation_type_id: Optional[int] = None
    consultation_fee: Optional[float] = None
    amount_paid: Optional[float] = None
    payment_status: Optional[str] = None
    payment_type: Optional[str] = None
    insurance_provider: Optional[str] = None
    insurance_id: Optional[str] = None
    insurance_number: Optional[str] = None
    insurance_coverage: Optional[float] = None
    insurance_limit: Optional[float] = None
    insurance_used: Optional[float] = None
    patient_topup: Optional[float] = None
    visioncare_member_id: Optional[str] = None
    visit_date: datetime
    created_at: datetime

    class Config:
        from_attributes = True
