/**
 * Stable import path for office check-in. Implementation lives under `services/office-flow/`.
 */
export type { OfficeCheckInScanRequest, OfficeCheckInScanResult } from '@/services/office-flow';
export { officeCheckInScanService, processOfficeCheckInScan } from '@/services/office-flow';
