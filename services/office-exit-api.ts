import { extractQrTokenFromAnyScan } from '@/lib/enrollee-progress-url';
import { parseQrTicketRaw } from '@/lib/qr-ticket-payload';
import { toSupabaseTimestampPh } from '@/lib/supabase-timestamp-ph';
import { supabase } from '@/services/database/supabase';
import {
  resolveSkippedExpectationStatusId,
  resolveValidationStatusId,
} from '@/services/office-flow/db-status-lookups';
import { resolveVisitorPhotoDisplayUri } from '@/services/storage/upload';

export interface ExitScanRequest {
  qrToken: string;
  rawQrValue: string;
  scannedByUserId: number;
  /** Gate guard exit does not use `office_staff`; office flow validates destination vs staff office. */
  scannerContext?: 'office' | 'guard';
}

export interface ExitScanResult {
  success: boolean;
  message?: string;
  errorCode?: string;
  data?: {
    visitId: number;
    visitorId: number;
    visitorName: string;
    passNumber: string | null;
    controlNumber: string | null;
    destinationOffice: string | null;
    expectedOffice: string | null;
    purposeReason: string | null;
    entryTime: string | null;
    registeredBy: string | null;
    isCorrectDestination: boolean;
    destinationStatusLabel: string;
    exitTime: string;
    durationMinutes: number;
    exitStatusId: number | null;
    /** Resolved from `exit_status` after update. */
    exitStatusName?: string | null;
    /** From `visit.destination_text` when set. */
    destinationText?: string | null;
    officeScanInserted?: boolean;
    /** Public URL or storage path from visitor.visitor_photo_with_id_url. */
    visitorPhotoUrl?: string | null;
  };
  debug?: {
    functionName: string;
    method?: string;
    requestBody?: ExitScanRequest;
    status?: number;
    rawResponse?: unknown;
    rawError?: string;
    errorName?: string;
  };
}

const OFFICE_EXIT_SCAN_FUNCTION = 'office-exit-scan';

type LookupResult = {
  visit: any;
  visitor: any;
  officeStaff: any;
  destinationOfficeName: string | null;
  expectedOfficeName: string | null;
  isCorrectDestination: boolean;
  destinationStatusLabel: string;
  registeredBy: string | null;
  officeScanInserted: boolean;
};

const normalize = (value: string | null | undefined): string => (value || '').trim();

const buildCandidates = (payload: ExitScanRequest): string[] => {
  const raw = normalize(payload.rawQrValue);
  const tokenFromPayload = normalize(payload.qrToken);
  const tokenFromRaw = extractQrTokenFromAnyScan(raw) || '';
  const parsed = parseQrTicketRaw(raw);

  const pipeParts = raw
    .split('|')
    .map((part) => part.trim())
    .filter(Boolean);

  const extractedFromParts = pipeParts
    .map((part) => extractQrTokenFromAnyScan(part) || (/QR-/i.test(part) ? part : ''))
    .filter(Boolean);

  // Prefer QR-… tokens only — never look up a full https URL as visit.qr_token
  const candidates = [
    tokenFromPayload,
    tokenFromRaw,
    parsed.qr_token || '',
    ...extractedFromParts,
    ...pipeParts.filter((p) => !/^https?:\/\//i.test(p)),
  ].filter((c) => c && !/^https?:\/\//i.test(c));

  return Array.from(new Set(candidates));
};

const getResponseStatus = (context: unknown): number | undefined => {
  if (!context || typeof context !== 'object') {
    return undefined;
  }

  const maybeContext = context as Record<string, unknown>;
  if (typeof maybeContext.status === 'number') {
    return maybeContext.status;
  }

  const nested = maybeContext.response as Record<string, unknown> | undefined;
  if (nested && typeof nested.status === 'number') {
    return nested.status;
  }

  return undefined;
};

const readErrorContextBody = async (context: unknown): Promise<unknown> => {
  if (!context || typeof context !== 'object') {
    return null;
  }

  const responseLike = context as Response;
  const hasText = typeof (responseLike as any).text === 'function';
  if (!hasText) {
    return context;
  }

  try {
    const rawText = await responseLike.text();
    if (!rawText) {
      return null;
    }

    try {
      return JSON.parse(rawText);
    } catch {
      return rawText;
    }
  } catch {
    return context;
  }
};

const VISIT_EXIT_SELECT =
  'visit_id, visitor_id, guard_user_id, primary_office_id, purpose_reason, destination_text, entry_time, exit_time, exit_status_id, qr_token, duration_minutes, pass_number, control_number';

const VISITOR_EXIT_SELECT =
  'visitor_id, first_name, last_name, visitor_photo_with_id_url';

const resolveScanByDatabase = async (payload: ExitScanRequest): Promise<ExitScanResult> => {
  const candidates = buildCandidates(payload);
  const isGuard = payload.scannerContext === 'guard';

  let officeStaff: { staff_id: number; user_id: number; office_id: number; position: string | null } | null = null;

  if (!isGuard) {
    const { data: officeStaffRow, error: officeStaffError } = await supabase
      .from('office_staff')
      .select('staff_id, user_id, office_id, position')
      .eq('user_id', payload.scannedByUserId)
      .maybeSingle();

    if (officeStaffError || !officeStaffRow) {
      return {
        success: false,
        message: 'Office account is not linked to this user.',
        errorCode: 'OFFICE_STAFF_NOT_FOUND',
        debug: {
          functionName: OFFICE_EXIT_SCAN_FUNCTION,
          method: 'POST',
          requestBody: payload,
          rawError: officeStaffError?.message,
        },
      };
    }

    officeStaff = officeStaffRow;
  }

  let visit: any | null = null;
  let visitor: any | null = null;

  const v1 = parseQrTicketRaw(payload.rawQrValue.trim());
  if (v1.payload != null && v1.qr_token) {
    const { data: visitFromTicket } = await supabase
      .from('visit')
      .select(VISIT_EXIT_SELECT)
      .eq('visit_id', v1.payload.visit_id)
      .eq('qr_token', v1.qr_token)
      .is('exit_time', null)
      .maybeSingle();
    if (visitFromTicket) {
      visit = visitFromTicket;
    }
  }

  if (visit && !visitor) {
    const { data: visitVisitor } = await supabase
      .from('visitor')
      .select(VISITOR_EXIT_SELECT)
      .eq('visitor_id', visit.visitor_id)
      .maybeSingle();
    if (visitVisitor) {
      visitor = visitVisitor;
    }
  }

  for (const candidate of candidates) {
    if (visit) {
      break;
    }
    const { data: byToken } = await supabase
      .from('visit')
      .select(VISIT_EXIT_SELECT)
      .eq('qr_token', candidate)
      .is('exit_time', null)
      .maybeSingle();

    if (byToken) {
      visit = byToken;
    } else {
      const { data: byControl } = await supabase
        .from('visit')
        .select(VISIT_EXIT_SELECT)
        .eq('control_number', candidate)
        .is('exit_time', null)
        .order('entry_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (byControl) {
        visit = byControl;
      } else {
        const { data: byPass } = await supabase
          .from('visit')
          .select(VISIT_EXIT_SELECT)
          .eq('pass_number', candidate)
          .is('exit_time', null)
          .order('entry_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (byPass) {
          visit = byPass;
        }
      }
    }

    if (visit) {
      const { data: visitVisitor } = await supabase
        .from('visitor')
        .select(VISITOR_EXIT_SELECT)
        .eq('visitor_id', visit.visitor_id)
        .maybeSingle();

      if (visitVisitor) {
        visitor = visitVisitor;
      }
      break;
    }
  }

  if (!visitor) {
    return {
      success: false,
      message: 'Visitor not found.',
      errorCode: 'VISITOR_NOT_FOUND',
      debug: {
        functionName: OFFICE_EXIT_SCAN_FUNCTION,
        method: 'POST',
        requestBody: payload,
        rawResponse: { candidates },
      },
    };
  }

  if (!visit) {
    return {
      success: false,
      message: 'Active visit not found for this visitor.',
      errorCode: 'ACTIVE_VISIT_NOT_FOUND',
      debug: {
        functionName: OFFICE_EXIT_SCAN_FUNCTION,
        method: 'POST',
        requestBody: payload,
        rawResponse: { candidates, visitorId: visitor.visitor_id },
      },
    };
  }

  const { data: destinationOffice } = await supabase
    .from('office')
    .select('office_id, office_name')
    .eq('office_id', visit.primary_office_id)
    .maybeSingle();

  let isCorrectDestination = true;
  let destinationStatusLabel = 'Facility exit';
  let expectedOffice: { office_id: number; office_name: string } | null = null;

  if (isGuard) {
    expectedOffice = destinationOffice;
  } else {
    const { data: expectations } = await supabase
      .from('office_expectation')
      .select('office_id, expected_order, expectation_status_id, arrived_at')
      .eq('visit_id', visit.visit_id)
      .order('expected_order', { ascending: true });

    const pendingExpectation =
      expectations?.find((entry: any) => !entry.arrived_at) || null;

    const expectedOfficeId = pendingExpectation?.office_id ?? visit.primary_office_id;

    const { data: expectedOfficeRow } = await supabase
      .from('office')
      .select('office_id, office_name')
      .eq('office_id', expectedOfficeId)
      .maybeSingle();

    expectedOffice = expectedOfficeRow;
    isCorrectDestination = officeStaff ? Number(expectedOfficeId) === Number(officeStaff.office_id) : false;
    destinationStatusLabel = isCorrectDestination ? 'Correct destination' : 'Wrong destination';
  }

  const { data: guardUser } = await supabase
    .from('users')
    .select('first_name, last_name, email')
    .eq('user_id', visit.guard_user_id)
    .maybeSingle();

  const registeredBy = guardUser
    ? `${guardUser.first_name || ''} ${guardUser.last_name || ''}`.trim() || guardUser.email || null
    : null;

  const exitTime = new Date();
  const entryTime = new Date(visit.entry_time || exitTime);
  const durationMinutes = Math.max(0, Math.floor((exitTime.getTime() - entryTime.getTime()) / 60000));

  const { data: exitStatusRows } = await supabase
    .from('exit_status')
    .select('exit_status_id, exit_status_name')
    .limit(20);

  const preferredExitStatus = (exitStatusRows || []).find((row: any) => {
    const name = normalize(row.exit_status_name).toLowerCase();
    return ['exited', 'completed', 'done'].includes(name);
  });

  const exitStatusId = preferredExitStatus?.exit_status_id || exitStatusRows?.[0]?.exit_status_id || null;
  const exitStatusName =
    (exitStatusRows || []).find((row: { exit_status_id: number }) => row.exit_status_id === exitStatusId)
      ?.exit_status_name ?? preferredExitStatus?.exit_status_name ?? null;

  const { error: visitUpdateError } = await supabase
    .from('visit')
    .update({
      exit_time: toSupabaseTimestampPh(exitTime),
      duration_minutes: durationMinutes,
      exit_status_id: exitStatusId,
    })
    .eq('visit_id', visit.visit_id);

  if (visitUpdateError) {
    return {
      success: false,
      message: 'Failed to update visit exit status.',
      errorCode: 'VISIT_UPDATE_FAILED',
      debug: {
        functionName: OFFICE_EXIT_SCAN_FUNCTION,
        method: 'POST',
        requestBody: payload,
        rawError: visitUpdateError.message,
      },
    };
  }

  // Visitor is exiting; any remaining un-arrived office expectations are skipped.
  const skippedExpectationStatusId = await resolveSkippedExpectationStatusId();
  const { error: expectationSkipError } = await supabase
    .from('office_expectation')
    .update({ expectation_status_id: skippedExpectationStatusId })
    .eq('visit_id', visit.visit_id)
    .is('arrived_at', null);

  if (expectationSkipError) {
    console.warn(
      '[office-exit] failed to mark pending expectations as skipped:',
      expectationSkipError.message,
    );
  }

  let officeScanInserted = false;
  const validationStatusId = await resolveValidationStatusId({ favorable: isCorrectDestination });

  // office_scan.office_id is NOT NULL — guard exit uses primary / last arrived / any expectation office
  let scanOfficeId: number | null = isGuard
    ? visit.primary_office_id != null
      ? Number(visit.primary_office_id)
      : null
    : officeStaff?.office_id != null
      ? Number(officeStaff.office_id)
      : null;

  if (scanOfficeId == null || !Number.isFinite(scanOfficeId)) {
    const { data: anyExp } = await supabase
      .from('office_expectation')
      .select('office_id, arrived_at, expected_order')
      .eq('visit_id', visit.visit_id)
      .order('expected_order', { ascending: false })
      .limit(20);
    const arrived = (anyExp ?? []).find((e) => e.arrived_at);
    const fallback = arrived ?? anyExp?.[0];
    if (fallback?.office_id != null) {
      scanOfficeId = Number(fallback.office_id);
    }
  }

  const scanRemarks = isGuard
    ? 'Guard facility exit scan'
    : isCorrectDestination
      ? 'Office scan validated: correct destination'
      : 'Office scan validated: wrong destination';

  if (scanOfficeId == null || !Number.isFinite(scanOfficeId)) {
    console.warn('[office-exit] skipping office_scan insert: no office_id available');
  } else {
    const { error: officeScanError } = await supabase.from('office_scan').insert({
      visit_id: visit.visit_id,
      office_id: scanOfficeId,
      scanned_by_user_id: payload.scannedByUserId,
      scan_time: toSupabaseTimestampPh(),
      validation_status_id: validationStatusId,
      remarks: scanRemarks,
    });

    if (!officeScanError) {
      officeScanInserted = true;
    } else {
      console.warn('[office-exit] office_scan insert failed:', officeScanError.message);
    }
  }

  const visitorName = `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim() || '(unknown visitor)';

  const rawPhoto =
    typeof visitor.visitor_photo_with_id_url === 'string' &&
    visitor.visitor_photo_with_id_url.trim().length > 0
      ? visitor.visitor_photo_with_id_url.trim()
      : null;
  const visitorPhotoUrl = (await resolveVisitorPhotoDisplayUri(rawPhoto)) || rawPhoto;

  return {
    success: true,
    message: 'Visitor scan processed successfully.',
    data: {
      visitId: Number(visit.visit_id),
      visitorId: Number(visitor.visitor_id),
      visitorName,
      passNumber: visit.pass_number || null,
      controlNumber: visit.control_number || null,
      destinationOffice: destinationOffice?.office_name || null,
      expectedOffice: expectedOffice?.office_name || null,
      purposeReason: visit.purpose_reason || null,
      destinationText: visit.destination_text || null,
      entryTime: visit.entry_time || null,
      registeredBy,
      isCorrectDestination,
      destinationStatusLabel,
      exitTime: toSupabaseTimestampPh(exitTime),
      durationMinutes,
      exitStatusId,
      exitStatusName: exitStatusName || null,
      officeScanInserted,
      visitorPhotoUrl,
    },
    debug: {
      functionName: OFFICE_EXIT_SCAN_FUNCTION,
      method: 'POST',
      requestBody: payload,
      rawResponse: { source: 'direct-database-fallback', candidates },
    },
  };
};

export const officeExitApiService = {
  async processExitScan(payload: ExitScanRequest): Promise<ExitScanResult> {
    const method = 'POST';

    if (__DEV__) {
      console.log('\n📡 === OFFICE EXIT SCAN REQUEST ===\n');
      console.log(`   Method: ${method}`);
      console.log(`   Function: ${OFFICE_EXIT_SCAN_FUNCTION}`);
      console.log(`   Scanner context: ${payload.scannerContext ?? 'office'}`);
    }

    if (payload.scannerContext === 'guard') {
      return resolveScanByDatabase(payload);
    }

    try {
      const { data, error } = await supabase.functions.invoke<ExitScanResult>(OFFICE_EXIT_SCAN_FUNCTION, {
        body: payload,
      });

      if (error) {
        const status = error.context?.status;
        const parsedErrorBody = await readErrorContextBody(error.context);
        const normalizedStatus = typeof status === 'number' ? status : getResponseStatus(error.context);

        if (normalizedStatus === 404) {
          console.warn('⚠️ Edge Function endpoint not found, using direct database fallback path.');
          return await resolveScanByDatabase(payload);
        }

        console.error('❌ Office exit scan function invocation failed', {
          functionName: OFFICE_EXIT_SCAN_FUNCTION,
          method,
          body: payload,
          errorName: error.name,
          errorMessage: error.message,
          status: normalizedStatus,
          parsedErrorBody,
          details: error.context,
        });

        if (parsedErrorBody && typeof parsedErrorBody === 'object') {
          const bodyObject = parsedErrorBody as Record<string, unknown>;
          return {
            success: false,
            message:
              (typeof bodyObject.message === 'string' && bodyObject.message) ||
              error.message ||
              'Unable to reach the Supabase exit scan function.',
            errorCode:
              (typeof bodyObject.errorCode === 'string' && bodyObject.errorCode) ||
              'EDGE_FUNCTION_ERROR',
            debug: {
              functionName: OFFICE_EXIT_SCAN_FUNCTION,
              method,
              status: normalizedStatus,
              requestBody: payload,
              rawError: error.message,
              errorName: error.name,
              rawResponse: parsedErrorBody,
            },
          };
        }

        return {
          success: false,
          message:
            error.message ||
            'Unable to reach the Supabase exit scan function.',
          errorCode: 'EDGE_FUNCTION_ERROR',
          debug: {
            functionName: OFFICE_EXIT_SCAN_FUNCTION,
            method,
            status: normalizedStatus,
            requestBody: payload,
            rawError: error.message,
            errorName: error.name,
            rawResponse: parsedErrorBody || error.context,
          },
        };
      }

      if (!data) {
        return {
          success: false,
          message: 'Supabase exit scan function returned an empty response.',
          errorCode: 'EMPTY_FUNCTION_RESPONSE',
          debug: {
            functionName: OFFICE_EXIT_SCAN_FUNCTION,
            method,
            requestBody: payload,
          },
        };
      }

      return {
        success: !!data.success,
        message: data.message,
        data: data.data,
        errorCode: data.errorCode,
        debug: {
          functionName: OFFICE_EXIT_SCAN_FUNCTION,
          method,
          requestBody: payload,
          rawResponse: data,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network error.';

      console.error('❌ Office exit scan fetch failed', {
        functionName: OFFICE_EXIT_SCAN_FUNCTION,
        method,
        body: payload,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: message,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        message: 'Exit scan failed. Unable to call the Supabase Edge Function.',
        errorCode: 'EDGE_FUNCTION_EXCEPTION',
        debug: {
          functionName: OFFICE_EXIT_SCAN_FUNCTION,
          method,
          requestBody: payload,
          rawError: message,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        },
      };
    }
  },
};
