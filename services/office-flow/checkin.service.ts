import { supabase } from '@/services/database/supabase';
import { resolveActiveVisitFromScanInput } from './active-visit-resolve';
import { VISIT_TYPE } from './constants';
import type { OfficeCheckInScanRequest, OfficeCheckInScanResult } from './checkin.types';
import { resolveCompletedStepStatusId, resolveValidationStatusId } from './db-status-lookups';
import { completeEnrolleeProgressAtOffice, nextOfficeIdFromEnrolleeProgress } from './enrollee-route';
import {
  expectationsAreFullyCheckedIn,
  firstPendingExpectation,
  loadExpectationsForVisit,
  type OfficeExpectationRow,
} from './expectation-route';

async function loadVisitorDisplay(visitorId: number) {
  const { data: visitor } = await supabase
    .from('visitor')
    .select('visitor_id, first_name, last_name, pass_number, control_number')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  const visitorName =
    visitor != null
      ? `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim() || 'Visitor'
      : 'Visitor';

  return { visitor, visitorName };
}

async function loadOfficeNames(expectedOfficeId: number, scanningOfficeId: number) {
  const [{ data: expectedOffice }, { data: scanningOffice }] = await Promise.all([
    supabase.from('office').select('office_name').eq('office_id', expectedOfficeId).maybeSingle(),
    supabase.from('office').select('office_name').eq('office_id', scanningOfficeId).maybeSingle(),
  ]);
  return {
    expectedOfficeName: expectedOffice?.office_name || 'Expected office',
    scanningOfficeName: scanningOffice?.office_name || 'This office',
  };
}

async function resolveExpectedStop(
  visit: NonNullable<Awaited<ReturnType<typeof resolveActiveVisitFromScanInput>>>,
  expectations: OfficeExpectationRow[],
): Promise<{ expectedOfficeId: number; pending: OfficeExpectationRow | undefined } | null> {
  const pending = firstPendingExpectation(expectations);
  if (pending != null) {
    return { expectedOfficeId: Number(pending.office_id), pending };
  }

  if (visit.visit_type_id === VISIT_TYPE.ENROLLEE) {
    const fromProgress = await nextOfficeIdFromEnrolleeProgress(visit.visitor_id);
    if (fromProgress != null) {
      return { expectedOfficeId: fromProgress, pending: undefined };
    }
  }

  if (visit.primary_office_id != null) {
    return { expectedOfficeId: Number(visit.primary_office_id), pending: undefined };
  }

  return null;
}

export async function processOfficeCheckInScan(req: OfficeCheckInScanRequest): Promise<OfficeCheckInScanResult> {
  const { rawQrValue, scanningOfficeId, scannedByUserId } = req;

  const visit = await resolveActiveVisitFromScanInput(rawQrValue);
  if (!visit) {
    return {
      success: false,
      authorized: false,
      title: 'Not found',
      message: 'No active visit matches this QR code.',
      errorCode: 'VISIT_NOT_FOUND',
    };
  }

  const { visitor, visitorName } = await loadVisitorDisplay(visit.visitor_id);
  const expectations = await loadExpectationsForVisit(visit.visit_id);

  if (expectationsAreFullyCheckedIn(expectations)) {
    return {
      success: true,
      authorized: false,
      title: 'Route complete',
      message:
        'Every office on this ticket has already been checked in. Use exit processing when the visitor leaves.',
      visitorName,
      visitId: visit.visit_id,
    };
  }

  const stop = await resolveExpectedStop(visit, expectations);
  if (stop == null) {
    return {
      success: false,
      authorized: false,
      title: 'No route',
      message: 'This visit has no expected office sequence yet.',
      visitorName,
      visitId: visit.visit_id,
      errorCode: 'NO_EXPECTATION',
    };
  }
  const { expectedOfficeId, pending } = stop;

  const { expectedOfficeName, scanningOfficeName } = await loadOfficeNames(expectedOfficeId, scanningOfficeId);
  const authorized = Number(scanningOfficeId) === Number(expectedOfficeId);
  const validationStatusId = await resolveValidationStatusId({ favorable: authorized });
  const scanTime = new Date().toISOString();
  const remarks = authorized
    ? 'Office check-in: authorized (correct destination)'
    : 'Office check-in: unauthorized (wrong destination)';

  const { data: insertedScan, error: scanErr } = await supabase
    .from('office_scan')
    .insert({
      visit_id: visit.visit_id,
      office_id: scanningOfficeId,
      scanned_by_user_id: scannedByUserId,
      scan_time: scanTime,
      validation_status_id: validationStatusId,
      remarks,
    })
    .select('scan_id')
    .maybeSingle();

  if (scanErr) {
    return {
      success: false,
      authorized: false,
      title: 'Error',
      message: scanErr.message || 'Could not save scan record.',
      visitorName,
      errorCode: 'SCAN_INSERT_FAILED',
    };
  }

  const scanId = insertedScan?.scan_id;

  if (!authorized) {
    await supabase.from('alerts').insert({
      visit_id: visit.visit_id,
      visitor_id: visit.visitor_id,
      scan_id: scanId ?? null,
      alert_type: 'Unauthorized',
      severity: 'Medium',
      message: `${visitorName} checked in at ${scanningOfficeName} but was expected at ${expectedOfficeName}.`,
      status: 'Unresolved',
      created_at: scanTime,
    });

    return {
      success: true,
      authorized: false,
      title: 'Unauthorized',
      message: `This visitor is expected at ${expectedOfficeName}, not here.`,
      visitorName,
      passNumber: visitor?.pass_number ?? null,
      controlNumber: visitor?.control_number ?? null,
      expectedOfficeName,
      scanningOfficeName,
      visitId: visit.visit_id,
    };
  }

  if (pending?.expectation_id != null) {
    await supabase.from('office_expectation').update({ arrived_at: scanTime }).eq('expectation_id', pending.expectation_id);
  }

  if (visit.visit_type_id === VISIT_TYPE.ENROLLEE) {
    const stepStatusId = await resolveCompletedStepStatusId();
    await completeEnrolleeProgressAtOffice(visit.visitor_id, scanningOfficeId, scanTime, stepStatusId);
  }

  return {
    success: true,
    authorized: true,
    title: 'Authorized',
    message: `${visitorName} is at the correct office for this step.`,
    visitorName,
    passNumber: visitor?.pass_number ?? null,
    controlNumber: visitor?.control_number ?? null,
    expectedOfficeName,
    scanningOfficeName,
    visitId: visit.visit_id,
  };
}

export const officeCheckInScanService = {
  processOfficeCheckInScan,
};
