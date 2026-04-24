/**
 * Office visit flow: active-visit resolution, route expectations, check-in scan, shared status lookups.
 * Kept separate from `officeService` in `services/office.ts` (office listing / name ↔ id helpers).
 */

export { VISIT_TYPE } from './constants';
export { resolveActiveVisitFromScanInput, type ActiveVisitRow } from './active-visit-resolve';
export { resolveValidationStatusId, resolveCompletedStepStatusId } from './db-status-lookups';
export {
  loadExpectationsForVisit,
  expectationsAreFullyCheckedIn,
  firstPendingExpectation,
  type OfficeExpectationRow,
} from './expectation-route';
export { nextOfficeIdFromEnrolleeProgress, completeEnrolleeProgressAtOffice } from './enrollee-route';

export type { OfficeCheckInScanRequest, OfficeCheckInScanResult } from './checkin.types';
export { processOfficeCheckInScan, officeCheckInScanService } from './checkin.service';
