/**
 * OCR-related types and interfaces
 */

export type IDType =
  | 'philsys'
  | 'passport'
  | 'drivers_license'
  | 'umid'
  | 'prc'
  | 'tin'
  | 'postal'
  | 'voters'
  | 'senior_citizen'
  | 'pwd'
  | 'philhealth'
  | 'sss'
  | 'school'
  | 'company'
  | 'barangay'
  | 'police_clearance'
  | 'nbi_clearance'
  | 'unknown';

export interface IDTypeDetectionResult {
  type: IDType;
  confidence: 'high' | 'medium' | 'low';
  detectedKeywords: string[];
}

export interface ParsedIDData {
  firstName: string;
  lastName: string;
  address: string;
  // Address components
  addressHouseNo?: string;
  addressStreet?: string;
  addressBarangay?: string;
  addressCityMunicipality?: string;
  addressProvince?: string;
  addressRegion?: string;
  confidence: 'high' | 'medium' | 'low';
  detectedIdType: IDType;
  rawOcrText?: string;
}

export interface OCRExtractionResult {
  success: boolean;
  text?: string;
  error?: string;
}
