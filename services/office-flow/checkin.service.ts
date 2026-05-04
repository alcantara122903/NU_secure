import { toSupabaseTimestampPh } from '@/lib/supabase-timestamp-ph';
import { supabase } from '@/services/database/supabase';
import { resolveActiveVisitFromScanInput } from './active-visit-resolve';
import { VISIT_TYPE } from './constants';
import type { OfficeCheckInScanRequest, OfficeCheckInScanResult } from './checkin.types';
import { resolveCompletedEnrolleeStatusId, resolveCompletedStepStatusId, resolveValidationStatusId } from './db-status-lookups';
import { completeEnrolleeProgressAtOffice, nextOfficeIdFromEnrolleeProgress } from './enrollee-route';
import {
  expectationsAreFullyCheckedIn,
  firstPendingExpectation,
  loadExpectationsForVisit,
  type OfficeExpectationRow,
} from './expectation-route';

type WrongDestinationAlertPayload = {
  visit_id: number;
  visitor_id: number;
  scan_id: number | null;
  alert_type: 'Unauthorized';
  severity: 'Medium';
  message: string;
  status: 'Unresolved';
  created_at: string;
};

async function loadVisitorDisplay(visitorId: number) {
  const { data: visitor } = await supabase
    .from('visitor')
    .select('visitor_id, first_name, last_name, pass_number, control_number, visitor_photo_with_id_url')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  const visitorName =
    visitor != null
      ? `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim() || 'Visitor'
      : 'Visitor';

  const rawPhoto = visitor?.visitor_photo_with_id_url;
  const visitorPhotoUrl =
    typeof rawPhoto === 'string' && rawPhoto.trim().length > 0 ? rawPhoto.trim() : null;

  return { visitor, visitorName, visitorPhotoUrl };
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
  // For enrollees, source of truth is enrollee step progress order.
  // This avoids mismatches when office_expectation rows become stale or incomplete.
  if (visit.visit_type_id === VISIT_TYPE.ENROLLEE) {
    const fromProgress = await nextOfficeIdFromEnrolleeProgress(visit.visitor_id);
    if (fromProgress != null) {
      const pendingByOffice = expectations.find((e) => !e.arrived_at && Number(e.office_id) === Number(fromProgress));
      return { expectedOfficeId: fromProgress, pending: pendingByOffice };
    }
  }

  const pending = firstPendingExpectation(expectations);
  if (pending != null) {
    return { expectedOfficeId: Number(pending.office_id), pending };
  }

  if (visit.primary_office_id != null) {
    return { expectedOfficeId: Number(visit.primary_office_id), pending: undefined };
  }

  return null;
}

async function loadRegisteredByName(userId: number | null): Promise<string | null> {
  if (!userId) {
    return null;
  }
  const { data } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) {
    return null;
  }
  const fullName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
  return fullName || data.email || null;
}

async function loadEnrolleeStepLabel(visitorId: number): Promise<string | null> {
  const { data: enrollee } = await supabase
    .from('enrollee')
    .select('enrollee_id')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  if (!enrollee?.enrollee_id) {
    return null;
  }

  const { data } = await supabase
    .from('enrollee_progress')
    .select('completed_at, step:enrollee_step(step_name, step_order)')
    .eq('enrollee_id', enrollee.enrollee_id);

  if (!Array.isArray(data)) {
    return null;
  }

  const incomplete = data
    .map((row) => {
      const r = row as {
        completed_at?: string | null;
        step?: { step_name?: string | null; step_order?: number | null } | Array<{ step_name?: string | null; step_order?: number | null }> | null;
      };
      const embedded = Array.isArray(r.step) ? r.step[0] : r.step;
      return {
        completed_at: r.completed_at ?? null,
        step_name: embedded?.step_name ?? null,
        step_order: embedded?.step_order ?? null,
      };
    })
    .filter((row) => !row.completed_at)
    .sort((a, b) => Number(a.step_order ?? 0) - Number(b.step_order ?? 0));

  const next = incomplete[0];
  if (!next) {
    return null;
  }
  return next.step_name ? `Step: ${next.step_name}` : next.step_order ? `Step ${next.step_order}` : 'Step';
}

async function createWrongDestinationAlert(payload: WrongDestinationAlertPayload): Promise<void> {
  const { error: firstErr } = await supabase.from('alerts').insert(payload);
  if (!firstErr) {
    return;
  }

  // Defensive fallback for misaligned alerts.alert_id sequence in production DB.
  if (firstErr.code !== '23505') {
    console.error('[OfficeCheckIn] failed to create wrong-destination alert:', firstErr);
    return;
  }

  const { data: maxRow, error: maxErr } = await supabase.from('alerts').select('alert_id').order('alert_id', { ascending: false }).limit(1).maybeSingle();
  if (maxErr) {
    console.error('[OfficeCheckIn] failed to recover alert sequence (read max alert_id):', maxErr);
    return;
  }

  const maxAlertId = typeof maxRow?.alert_id === 'number' && Number.isFinite(maxRow.alert_id) ? maxRow.alert_id : 0;
  const candidateStart = maxAlertId + 1;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const alert_id = candidateStart + attempt;
    const { error: retryErr } = await supabase.from('alerts').insert({ ...payload, alert_id });
    if (!retryErr) {
      return;
    }
    if (retryErr.code !== '23505') {
      console.error('[OfficeCheckIn] failed to create wrong-destination alert after fallback:', retryErr);
      return;
    }
  }

  console.error('[OfficeCheckIn] failed to create wrong-destination alert after duplicate-key retries.');
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

  const { visitor, visitorName, visitorPhotoUrl } = await loadVisitorDisplay(visit.visitor_id);
  const expectations = await loadExpectationsForVisit(visit.visit_id);
  // In office scan UI, "Registered By" refers to the current office staff
  // performing this scan, per business requirement.
  const registeredBy = await loadRegisteredByName(scannedByUserId);

  if (expectationsAreFullyCheckedIn(expectations)) {
    return {
      success: true,
      authorized: false,
      title: 'Route complete',
      message:
        'Every office on this ticket has already been checked in. Use exit processing when the visitor leaves.',
      visitorName,
      visitorPhotoUrl,
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
  const purposeLabel = visit.visit_type_id === VISIT_TYPE.ENROLLEE ? 'Step' : 'Purpose of Visit';
  const enrolleeStep = visit.visit_type_id === VISIT_TYPE.ENROLLEE ? await loadEnrolleeStepLabel(visit.visitor_id) : null;
  const purposeReason = visit.visit_type_id === VISIT_TYPE.ENROLLEE ? enrolleeStep || 'Step' : visit.purpose_reason || '(not provided)';
  const validationStatusId = await resolveValidationStatusId({ favorable: authorized });
  const scanTime = toSupabaseTimestampPh();
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
    await createWrongDestinationAlert({
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
      visitorPhotoUrl,
      passNumber: visitor?.pass_number ?? null,
      controlNumber: visitor?.control_number ?? null,
      purposeLabel,
      purposeReason,
      entryTime: visit.entry_time,
      scanTime,
      registeredBy,
      destinationStatusLabel: 'Wrong office destination',
      isCorrectDestination: false,
      destinationOffice: scanningOfficeName,
      expectedOfficeName,
      scanningOfficeName,
      visitId: visit.visit_id,
    };
  }

  if (pending?.expectation_id != null) {
    await supabase
      .from('office_expectation')
      .update({ arrived_at: scanTime, expectation_status_id: 4 })
      .eq('expectation_id', pending.expectation_id);
  } else {
    // Fallback: when pending expectation_id is unavailable, mark the current office row as completed.
    await supabase
      .from('office_expectation')
      .update({ arrived_at: scanTime, expectation_status_id: 4 })
      .eq('visit_id', visit.visit_id)
      .eq('office_id', scanningOfficeId)
      .is('arrived_at', null);
  }

  if (visit.visit_type_id === VISIT_TYPE.ENROLLEE) {
    const stepStatusId = await resolveCompletedStepStatusId();
    const enrolleeCompletedStatusId = await resolveCompletedEnrolleeStatusId();
    const completedAllSteps = await completeEnrolleeProgressAtOffice(
      visit.visitor_id,
      scanningOfficeId,
      scanTime,
      stepStatusId,
      enrolleeCompletedStatusId,
    );
    if (completedAllSteps) {
      return {
        success: true,
        authorized: true,
        title: 'Authorized',
        message: `${visitorName} completed all enrollee steps.`,
        visitorName,
        visitorPhotoUrl,
        passNumber: visitor?.pass_number ?? null,
        controlNumber: visitor?.control_number ?? null,
        purposeLabel,
        purposeReason,
        entryTime: visit.entry_time,
        scanTime,
        registeredBy,
        destinationStatusLabel: 'Correct destination',
        enrolleeStatusLabel: 'Enrollee status: Completed',
        isCorrectDestination: true,
        destinationOffice: expectedOfficeName,
        expectedOfficeName,
        scanningOfficeName,
        visitId: visit.visit_id,
      };
    }
  }

  return {
    success: true,
    authorized: true,
    title: 'Authorized',
    message: `${visitorName} is at the correct office for this step.`,
    visitorName,
    visitorPhotoUrl,
    passNumber: visitor?.pass_number ?? null,
    controlNumber: visitor?.control_number ?? null,
    purposeLabel,
    purposeReason,
    entryTime: visit.entry_time,
    scanTime,
    registeredBy,
    destinationStatusLabel: 'Correct destination',
    isCorrectDestination: true,
    destinationOffice: expectedOfficeName,
    expectedOfficeName,
    scanningOfficeName,
    visitId: visit.visit_id,
  };
}

export const officeCheckInScanService = {
  processOfficeCheckInScan,
};
