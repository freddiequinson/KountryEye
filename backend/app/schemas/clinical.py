from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ConsultationTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    base_fee: float = 0
    initial_fee: float = 0
    review_fee: float = 0
    subsequent_fee: float = 0


class ConsultationTypeCreate(ConsultationTypeBase):
    pass


class ConsultationTypeResponse(ConsultationTypeBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ConsultationCreate(BaseModel):
    visit_id: int
    consultation_type_id: int
    doctor_id: int
    fee: Optional[float] = None


class ConsultationResponse(BaseModel):
    id: int
    visit_id: int
    consultation_type_id: int
    doctor_id: int
    fee: float
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ClinicalRecordBase(BaseModel):
    chief_complaint: Optional[str] = None
    history_of_present_illness: Optional[str] = None
    past_ocular_history: Optional[str] = None
    past_medical_history: Optional[str] = None
    family_history: Optional[str] = None
    social_history: Optional[str] = None
    allergies: Optional[str] = None
    current_medications: Optional[str] = None
    
    visual_acuity_od: Optional[str] = None
    visual_acuity_os: Optional[str] = None
    visual_acuity_ou: Optional[str] = None
    pinhole_od: Optional[str] = None
    pinhole_os: Optional[str] = None
    
    iop_od: Optional[str] = None
    iop_os: Optional[str] = None
    
    refraction_od_sphere: Optional[str] = None
    refraction_od_cylinder: Optional[str] = None
    refraction_od_axis: Optional[str] = None
    refraction_os_sphere: Optional[str] = None
    refraction_os_cylinder: Optional[str] = None
    refraction_os_axis: Optional[str] = None
    refraction_add: Optional[str] = None
    refraction_pd: Optional[str] = None
    
    anterior_segment_od: Optional[str] = None
    anterior_segment_os: Optional[str] = None
    posterior_segment_od: Optional[str] = None
    posterior_segment_os: Optional[str] = None
    
    diagnosis: Optional[str] = None
    differential_diagnosis: Optional[str] = None
    management_plan: Optional[str] = None
    
    follow_up_date: Optional[datetime] = None
    follow_up_notes: Optional[str] = None


class ClinicalRecordCreate(ClinicalRecordBase):
    consultation_id: int


class ClinicalRecordUpdate(ClinicalRecordBase):
    pass


class ClinicalRecordResponse(ClinicalRecordBase):
    id: int
    consultation_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PrescriptionItemBase(BaseModel):
    medication_name: str
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    instructions: Optional[str] = None
    quantity: int = 1


class PrescriptionBase(BaseModel):
    prescription_type: Optional[str] = None
    sphere_od: Optional[str] = None
    cylinder_od: Optional[str] = None
    axis_od: Optional[str] = None
    va_od: Optional[str] = None
    sphere_os: Optional[str] = None
    cylinder_os: Optional[str] = None
    axis_os: Optional[str] = None
    va_os: Optional[str] = None
    add_power: Optional[str] = None
    pd: Optional[str] = None
    segment_height: Optional[str] = None
    lens_type: Optional[str] = None
    lens_material: Optional[str] = None
    lens_coating: Optional[str] = None
    frame_type: Optional[str] = None
    frame_code: Optional[str] = None
    frame_size: Optional[str] = None
    notes: Optional[str] = None
    remarks: Optional[str] = None
    dispensed_by_name: Optional[str] = None
    delivery_date: Optional[datetime] = None


class PrescriptionCreate(PrescriptionBase):
    consultation_id: int
    items: Optional[List[PrescriptionItemBase]] = []


class PrescriptionResponse(PrescriptionBase):
    id: int
    consultation_id: int
    is_dispensed: bool
    dispensed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
