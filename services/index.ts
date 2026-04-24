/**
 * Services Barrel Export
 * Main entry point for all service modules
 */

// Authentication
export * from './authentication';

// OCR and ID Processing
export * from './ocr';

// Visitor Management
export * from './visitor';

// Database
export * from './database';

// Storage (Supabase Storage for uploads)
export * from './storage';

// Camera
export { cameraService } from './camera';

// Address
export { addressService, type AddressData } from './address';

// Office visit flow (check-in scan, visit resolution helpers — not `office.ts` listing API)
export {
  VISIT_TYPE,
  officeCheckInScanService,
  processOfficeCheckInScan,
  resolveActiveVisitFromScanInput,
  resolveValidationStatusId,
} from './office-flow';

