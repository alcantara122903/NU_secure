/**
 * Visitor & Enrollee Types
 * Domain model for visitor management and enrollment
 */

export interface Visitor {
  visitor_id: number;
  first_name: string;
  last_name: string;
  contact_no?: string;
  pass_number?: string;
  control_number?: string;
  visitor_photo_with_id_url?: string;
  address_id?: number;
  created_at: string;
}

export interface IDExtractionData {
  firstName: string;
  lastName: string;
  address: string;
  addressHouseNo?: string;
  addressStreet?: string;
  addressBarangay?: string;
  addressCityMunicipality?: string;
  addressProvince?: string;
  addressRegion?: string;
  confidence?: 'high' | 'medium' | 'low';
  detectedIdType?: string;
}

export interface Enrollee {
  enrollee_id: number;
  visitor_id: number;
  status: 'pending' | 'in-progress' | 'completed';
  updated_at: string;
}

export interface EnrolleeStep {
  step_id: number;
  step_name: string;
  step_order: number;
  is_active: boolean;
  status: string;
  completed_at?: string;
}

export interface EnrolleeQRData {
  enrollee_id: number;
  first_name: string;
  last_name: string;
  address: string;
  registration_date: string;
  status: string;
  facePhotoUri?: string;
  idPhotoUri?: string;
}

export interface VisitorRegistrationData {
  firstName: string;
  lastName: string;
  addressHouseNo?: string;
  addressStreet?: string;
  addressBarangay?: string;
  addressMunicipality?: string;
  addressProvince?: string;
  addressRegion?: string;
  contactNo?: string;
  facePhotoUri?: string;
  idPhotoUri?: string;
}
