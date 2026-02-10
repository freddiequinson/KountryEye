export interface User {
  id: number;
  email: string;
  full_name: string;
  role_id?: number;
  branch_id?: number;
  is_active: boolean;
  is_superuser: boolean;
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  is_main?: boolean;
  // Geolocation settings
  latitude?: number;
  longitude?: number;
  geofence_radius?: number;
  // Work hours settings
  work_start_time?: string;
  work_end_time?: string;
  late_threshold_minutes?: number;
  require_geolocation?: boolean;
  created_at?: string;
}

export interface Patient {
  id: number;
  patient_number: string;
  first_name: string;
  last_name: string;
  other_names?: string;
  date_of_birth?: string;
  sex?: 'male' | 'female' | 'other';
  marital_status?: string;
  phone?: string;
  email?: string;
  address?: string;
  occupation?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  branch_id: number;
  created_at: string;
}

export interface Visit {
  id: number;
  patient_id: number;
  branch_id: number;
  recorded_by_id: number;
  visit_type: 'initial' | 'review' | 'subsequent' | 'full_checkup';
  reason?: string;
  notes?: string;
  status: string;
  visit_date: string;
  created_at: string;
}

export interface Consultation {
  id: number;
  visit_id: number;
  consultation_type_id: number;
  doctor_id: number;
  fee: number;
  status: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface ClinicalRecord {
  id: number;
  consultation_id: number;
  chief_complaint?: string;
  diagnosis?: string;
  management_plan?: string;
  visual_acuity_od?: string;
  visual_acuity_os?: string;
  iop_od?: string;
  iop_os?: string;
  refraction_od_sphere?: string;
  refraction_od_cylinder?: string;
  refraction_od_axis?: string;
  refraction_os_sphere?: string;
  refraction_os_cylinder?: string;
  refraction_os_axis?: string;
  created_at: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category_id?: number;
  unit_price: number;
  cost_price?: number;
  is_active: boolean;
  requires_prescription: boolean;
  created_at: string;
}

export interface Sale {
  id: number;
  receipt_number: string;
  branch_id: number;
  patient_id?: number;
  cashier_id: number;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  payment_status: string;
  created_at: string;
}

export interface Asset {
  id: number;
  asset_tag: string;
  name: string;
  description?: string;
  category_id?: number;
  branch_id?: number;
  location?: string;
  status: string;
  condition: string;
  next_maintenance_date?: string;
  is_active: boolean;
  created_at: string;
}

export interface Campaign {
  id: number;
  name: string;
  description?: string;
  campaign_type?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  status: string;
  created_at: string;
}

export interface CustomerRating {
  id: number;
  patient_id?: number;
  branch_id: number;
  overall_rating?: number;
  service_rating?: number;
  staff_rating?: number;
  facility_rating?: number;
  wait_time_rating?: number;
  feedback?: string;
  would_recommend?: boolean;
  created_at: string;
}

export interface DashboardStats {
  patients: {
    today: number;
    month: number;
    total: number;
  };
  visits: {
    today: number;
    month: number;
  };
  sales: {
    today: number;
    month: number;
  };
  pending_consultations: number;
}
