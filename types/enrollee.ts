/**
 * Enrollee Types
 */

export interface IDExtractionData {
  firstName: string;
  lastName: string;
  address: string;
  confidence?: 'high' | 'medium' | 'low';
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
