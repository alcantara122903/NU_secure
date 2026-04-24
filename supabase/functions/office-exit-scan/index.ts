import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type IncomingBody = {
  qrToken?: string;
  rawQrValue?: string;
  scannedByUserId?: number | string;
  controlNumber?: string;
  passNumber?: string;
  visitId?: number | string;
  visitorId?: number | string;
};

type ExitScanResponse = {
  success: boolean;
  message: string;
  errorCode: string | null;
  data: {
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
    officeScanInserted: boolean;
  } | null;
  debug?: Record<string, unknown>;
};

type LookupCandidate =
  | { kind: 'visit_id'; value: number }
  | { kind: 'visit_qr_token'; value: string }
  | { kind: 'visitor_control_number'; value: string }
  | { kind: 'visitor_pass_number'; value: string }
  | { kind: 'visitor_id'; value: number }
  | { kind: 'raw'; value: string };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

const jsonResponse = (payload: ExitScanResponse): Response => {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: corsHeaders,
  });
};

const parseInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const getSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const parseRawQr = (raw: string): Partial<IncomingBody> & { qrParts: string[] } => {
  const trimmed = raw.trim();
  const result: Partial<IncomingBody> & { qrParts: string[] } = { qrParts: [] };

  if (!trimmed) {
    return result;
  }

  if (trimmed.includes('|')) {
    const parts = trimmed
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);

    result.qrParts = parts;

    for (const part of parts) {
      if (!result.controlNumber && /^\d{4}-/.test(part)) {
        result.controlNumber = part;
      }
      if (!result.qrToken && /QR-/i.test(part)) {
        result.qrToken = part;
      }
    }
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') {
      result.qrToken = parsed.trim();
    } else if (parsed && typeof parsed === 'object') {
      const objectValue = parsed as Record<string, unknown>;
      result.qrToken = normalizeText(objectValue.qrToken || objectValue.qr_token) || result.qrToken;
      result.controlNumber = normalizeText(objectValue.controlNumber || objectValue.control_number) || result.controlNumber;
      result.passNumber = normalizeText(objectValue.passNumber || objectValue.pass_number) || result.passNumber;
      result.visitId = objectValue.visitId || objectValue.visit_id;
      result.visitorId = objectValue.visitorId || objectValue.visitor_id;
    }
  } catch {
    // not json
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      result.qrToken =
        normalizeText(url.searchParams.get('qrToken')) ||
        normalizeText(url.searchParams.get('qr_token')) ||
        normalizeText(url.searchParams.get('token')) ||
        result.qrToken;

      result.controlNumber =
        normalizeText(url.searchParams.get('controlNumber')) ||
        normalizeText(url.searchParams.get('control_number')) ||
        result.controlNumber;

      result.passNumber =
        normalizeText(url.searchParams.get('passNumber')) ||
        normalizeText(url.searchParams.get('pass_number')) ||
        result.passNumber;

      result.visitId = url.searchParams.get('visitId') || url.searchParams.get('visit_id') || result.visitId;
      result.visitorId = url.searchParams.get('visitorId') || url.searchParams.get('visitor_id') || result.visitorId;
    } catch {
      // invalid url
    }
  }

  if (!result.qrToken) {
    result.qrToken = trimmed;
  }

  return result;
};

const pushUniqueCandidate = (target: LookupCandidate[], candidate: LookupCandidate) => {
  const exists = target.some((entry) => entry.kind === candidate.kind && entry.value === candidate.value);
  if (!exists) {
    target.push(candidate);
  }
};

const buildLookupCandidates = (body: IncomingBody) => {
  const rawQrValue = normalizeText(body.rawQrValue);
  const parsedRaw = rawQrValue ? parseRawQr(rawQrValue) : { qrParts: [] };
  const qrToken = normalizeText(body.qrToken) || normalizeText(parsedRaw.qrToken);
  const controlNumber = normalizeText(body.controlNumber) || normalizeText(parsedRaw.controlNumber);
  const passNumber = normalizeText(body.passNumber) || normalizeText(parsedRaw.passNumber);
  const visitId = parseInteger(body.visitId) || parseInteger(parsedRaw.visitId);
  const visitorId = parseInteger(body.visitorId) || parseInteger(parsedRaw.visitorId);

  const candidates: LookupCandidate[] = [];

  if (visitId) {
    pushUniqueCandidate(candidates, { kind: 'visit_id', value: visitId });
  }
  if (qrToken) {
    pushUniqueCandidate(candidates, { kind: 'visit_qr_token', value: qrToken });
  }
  if (controlNumber) {
    pushUniqueCandidate(candidates, { kind: 'visitor_control_number', value: controlNumber });
  }
  if (passNumber) {
    pushUniqueCandidate(candidates, { kind: 'visitor_pass_number', value: passNumber });
  }
  if (visitorId) {
    pushUniqueCandidate(candidates, { kind: 'visitor_id', value: visitorId });
  }

  for (const part of parsedRaw.qrParts) {
    if (/QR-/i.test(part)) {
      pushUniqueCandidate(candidates, { kind: 'visit_qr_token', value: part });
    } else if (/^\d{4}-/.test(part)) {
      pushUniqueCandidate(candidates, { kind: 'visitor_control_number', value: part });
    } else {
      pushUniqueCandidate(candidates, { kind: 'raw', value: part });
    }
  }

  if (rawQrValue) {
    pushUniqueCandidate(candidates, { kind: 'raw', value: rawQrValue });
  }

  return {
    candidates,
    normalized: {
      rawQrValue,
      qrToken,
      controlNumber,
      passNumber,
      visitId,
      visitorId,
      qrParts: parsedRaw.qrParts,
    },
  };
};

const getVisitor = async (supabase: ReturnType<typeof getSupabaseClient>, visitorId: number) => {
  const { data, error } = await supabase
    .from('visitor')
    .select('visitor_id, first_name, last_name, pass_number, control_number')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  return { data, error };
};

const getActiveVisitByVisitorId = async (supabase: ReturnType<typeof getSupabaseClient>, visitorId: number) => {
  const { data, error } = await supabase
    .from('visit')
    .select('visit_id, visitor_id, guard_user_id, primary_office_id, purpose_reason, entry_time, exit_time, duration_minutes, exit_status_id, qr_token')
    .eq('visitor_id', visitorId)
    .is('exit_time', null)
    .order('entry_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, error };
};

const lookupVisitAndVisitor = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  candidate: LookupCandidate,
): Promise<{ visit: any | null; visitor: any | null; debug: Record<string, unknown> }> => {
  if (candidate.kind === 'visit_id') {
    const visitResult = await supabase
      .from('visit')
      .select('visit_id, visitor_id, guard_user_id, primary_office_id, purpose_reason, entry_time, exit_time, duration_minutes, exit_status_id, qr_token')
      .eq('visit_id', candidate.value)
      .maybeSingle();

    if (visitResult.error || !visitResult.data) {
      return { visit: null, visitor: null, debug: { candidate, error: visitResult.error?.message || null } };
    }

    const visitorResult = await getVisitor(supabase, visitResult.data.visitor_id);
    return {
      visit: visitResult.data,
      visitor: visitorResult.data || null,
      debug: { candidate, visitFound: true, visitorFound: !!visitorResult.data },
    };
  }

  if (candidate.kind === 'visit_qr_token' || candidate.kind === 'raw') {
    const visitResult = await supabase
      .from('visit')
      .select('visit_id, visitor_id, guard_user_id, primary_office_id, purpose_reason, entry_time, exit_time, duration_minutes, exit_status_id, qr_token')
      .eq('qr_token', candidate.value)
      .maybeSingle();

    if (visitResult.data && !visitResult.error) {
      const visitorResult = await getVisitor(supabase, visitResult.data.visitor_id);
      return {
        visit: visitResult.data,
        visitor: visitorResult.data || null,
        debug: { candidate, via: 'visit.qr_token', visitFound: true, visitorFound: !!visitorResult.data },
      };
    }

    if (candidate.kind === 'raw') {
      const byControl = await supabase
        .from('visitor')
        .select('visitor_id, first_name, last_name, pass_number, control_number')
        .eq('control_number', candidate.value)
        .maybeSingle();

      if (byControl.data && !byControl.error) {
        const activeVisit = await getActiveVisitByVisitorId(supabase, byControl.data.visitor_id);
        return {
          visit: activeVisit.data || null,
          visitor: byControl.data,
          debug: {
            candidate,
            via: 'visitor.control_number(raw)',
            visitorFound: true,
            activeVisitFound: !!activeVisit.data,
          },
        };
      }

      const byPass = await supabase
        .from('visitor')
        .select('visitor_id, first_name, last_name, pass_number, control_number')
        .eq('pass_number', candidate.value)
        .maybeSingle();

      if (byPass.data && !byPass.error) {
        const activeVisit = await getActiveVisitByVisitorId(supabase, byPass.data.visitor_id);
        return {
          visit: activeVisit.data || null,
          visitor: byPass.data,
          debug: {
            candidate,
            via: 'visitor.pass_number(raw)',
            visitorFound: true,
            activeVisitFound: !!activeVisit.data,
          },
        };
      }
    }

    return {
      visit: null,
      visitor: null,
      debug: { candidate, error: visitResult.error?.message || null, via: 'visit.qr_token' },
    };
  }

  if (candidate.kind === 'visitor_control_number') {
    const visitorResult = await supabase
      .from('visitor')
      .select('visitor_id, first_name, last_name, pass_number, control_number')
      .eq('control_number', candidate.value)
      .maybeSingle();

    if (visitorResult.error || !visitorResult.data) {
      return { visit: null, visitor: null, debug: { candidate, error: visitorResult.error?.message || null } };
    }

    const activeVisit = await getActiveVisitByVisitorId(supabase, visitorResult.data.visitor_id);
    return {
      visit: activeVisit.data || null,
      visitor: visitorResult.data,
      debug: {
        candidate,
        via: 'visitor.control_number',
        visitorFound: true,
        activeVisitFound: !!activeVisit.data,
      },
    };
  }

  if (candidate.kind === 'visitor_pass_number') {
    const visitorResult = await supabase
      .from('visitor')
      .select('visitor_id, first_name, last_name, pass_number, control_number')
      .eq('pass_number', candidate.value)
      .maybeSingle();

    if (visitorResult.error || !visitorResult.data) {
      return { visit: null, visitor: null, debug: { candidate, error: visitorResult.error?.message || null } };
    }

    const activeVisit = await getActiveVisitByVisitorId(supabase, visitorResult.data.visitor_id);
    return {
      visit: activeVisit.data || null,
      visitor: visitorResult.data,
      debug: {
        candidate,
        via: 'visitor.pass_number',
        visitorFound: true,
        activeVisitFound: !!activeVisit.data,
      },
    };
  }

  const visitorResult = await getVisitor(supabase, candidate.value);
  if (visitorResult.error || !visitorResult.data) {
    return { visit: null, visitor: null, debug: { candidate, error: visitorResult.error?.message || null } };
  }

  const activeVisit = await getActiveVisitByVisitorId(supabase, visitorResult.data.visitor_id);
  return {
    visit: activeVisit.data || null,
    visitor: visitorResult.data,
    debug: {
      candidate,
      via: 'visitor_id',
      visitorFound: true,
      activeVisitFound: !!activeVisit.data,
    },
  };
};

const resolveStatusId = async (
  supabase: ReturnType<typeof getSupabaseClient>,
  table: 'exit_status' | 'validation_status',
  field: 'exit_status_id' | 'validation_status_id',
  names: string[],
): Promise<number | null> => {
  const { data, error } = await supabase
    .from(table)
    .select(`${field}, status_name, exit_status_name`)
    .limit(30);

  console.log(`[office-exit-scan] ${table} lookup`, { error, data });

  if (error || !data || !data.length) {
    return null;
  }

  const hit = data.find((row: Record<string, unknown>) => {
    const name = String(row.status_name || row.exit_status_name || '').toLowerCase();
    return names.some((target) => name === target.toLowerCase());
  });

  if (hit && typeof hit[field] === 'number') {
    return hit[field] as number;
  }

  const fallback = data[0];
  return typeof fallback[field] === 'number' ? (fallback[field] as number) : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body: IncomingBody = {};
  try {
    body = await req.json();
  } catch (error) {
    console.error('[office-exit-scan] invalid JSON body', error);
    return jsonResponse({
      success: false,
      message: 'Invalid QR payload format.',
      errorCode: 'INVALID_JSON',
      data: null,
      debug: { reason: 'request body is not valid JSON' },
    });
  }

  console.log('[office-exit-scan] incoming request body', body);

  const scannedByUserId = parseInteger(body.scannedByUserId);
  const lookup = buildLookupCandidates(body);

  console.log('[office-exit-scan] parsed qr details', lookup.normalized);
  console.log('[office-exit-scan] lookup candidates', lookup.candidates);

  if (!scannedByUserId) {
    return jsonResponse({
      success: false,
      message: 'Session not found. Please log in again.',
      errorCode: 'INVALID_SCANNER',
      data: null,
    });
  }

  if (!lookup.candidates.length) {
    return jsonResponse({
      success: false,
      message: 'Invalid QR format. Please use a valid visitor QR ticket.',
      errorCode: 'INVALID_QR_FORMAT',
      data: null,
      debug: lookup.normalized,
    });
  }

  try {
    const supabase = getSupabaseClient();

    const { data: officeStaff, error: officeStaffError } = await supabase
      .from('office_staff')
      .select('staff_id, user_id, office_id, position')
      .eq('user_id', scannedByUserId)
      .maybeSingle();

    console.log('[office-exit-scan] office staff lookup', { officeStaffError, officeStaff });

    if (officeStaffError || !officeStaff) {
      return jsonResponse({
        success: false,
        message: 'Office account is not linked to this user.',
        errorCode: 'OFFICE_STAFF_NOT_FOUND',
        data: null,
      });
    }

    let visit: any | null = null;
    let visitor: any | null = null;
    const lookupDebug: Record<string, unknown> = {};

    for (const candidate of lookup.candidates) {
      const result = await lookupVisitAndVisitor(supabase, candidate);
      lookupDebug[`${candidate.kind}:${String(candidate.value)}`] = result.debug;
      console.log('[office-exit-scan] candidate result', { candidate, debug: result.debug });

      if (result.visit && result.visitor) {
        visit = result.visit;
        visitor = result.visitor;
        break;
      }
    }

    if (!visitor) {
      return jsonResponse({
        success: false,
        message: 'Visitor not found.',
        errorCode: 'VISITOR_NOT_FOUND',
        data: null,
        debug: lookupDebug,
      });
    }

    if (!visit) {
      return jsonResponse({
        success: false,
        message: 'Active visit not found for this visitor.',
        errorCode: 'ACTIVE_VISIT_NOT_FOUND',
        data: null,
        debug: { lookupDebug, visitorId: visitor.visitor_id },
      });
    }

    if (visit.exit_time) {
      return jsonResponse({
        success: false,
        message: 'Visitor already exited.',
        errorCode: 'ALREADY_EXITED',
        data: null,
        debug: { visitId: visit.visit_id },
      });
    }

    const { data: destinationOffice } = await supabase
      .from('office')
      .select('office_id, office_name')
      .eq('office_id', visit.primary_office_id)
      .maybeSingle();

    const { data: expectedRoute } = await supabase
      .from('office_expectation')
      .select('office_id, expected_order, expectation_status_id, arrived_at')
      .eq('visit_id', visit.visit_id)
      .order('expected_order', { ascending: true });

    const pendingExpectation =
      expectedRoute?.find((entry: any) => !entry.arrived_at) ||
      expectedRoute?.find((entry: any) => entry.expectation_status_id === 1) ||
      null;

    const expectedOfficeId = pendingExpectation?.office_id ?? visit.primary_office_id;

    const { data: expectedOffice } = await supabase
      .from('office')
      .select('office_id, office_name')
      .eq('office_id', expectedOfficeId)
      .maybeSingle();

    const isCorrectDestination = Number(expectedOfficeId) === Number(officeStaff.office_id);

    const destinationStatusLabel = isCorrectDestination
      ? 'Correct destination'
      : 'Wrong destination';

    const { data: registeredByUser } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('user_id', visit.guard_user_id)
      .maybeSingle();

    const registeredBy = registeredByUser
      ? `${registeredByUser.first_name || ''} ${registeredByUser.last_name || ''}`.trim() ||
        registeredByUser.email ||
        null
      : null;

    const exitTime = new Date();
    const entry = new Date(visit.entry_time || exitTime.toISOString());
    const durationMinutes = Math.max(0, Math.floor((exitTime.getTime() - entry.getTime()) / 60000));

    const exitStatusId = await resolveStatusId(
      supabase,
      'exit_status',
      'exit_status_id',
      ['Exited', 'Completed', 'Done'],
    );

    const validStatusNames = isCorrectDestination
      ? ['Correct', 'Valid', 'Approved']
      : ['Wrong', 'Invalid', 'Rejected'];

    const validationStatusId = await resolveStatusId(
      supabase,
      'validation_status',
      'validation_status_id',
      validStatusNames,
    );

    const { error: visitUpdateError } = await supabase
      .from('visit')
      .update({
        exit_time: exitTime.toISOString(),
        duration_minutes: durationMinutes,
        exit_status_id: exitStatusId,
      })
      .eq('visit_id', visit.visit_id);

    console.log('[office-exit-scan] visit update', { visitUpdateError });

    if (visitUpdateError) {
      return jsonResponse({
        success: false,
        message: 'Failed to update visit status.',
        errorCode: 'VISIT_UPDATE_FAILED',
        data: null,
        debug: { visitUpdateError: visitUpdateError.message },
      });
    }

    let officeScanInserted = false;
    const { error: officeScanError } = await supabase
      .from('office_scan')
      .insert({
        visit_id: visit.visit_id,
        office_id: officeStaff.office_id,
        scanned_by_user_id: scannedByUserId,
        scan_time: exitTime.toISOString(),
        validation_status_id: validationStatusId,
        remarks: isCorrectDestination
          ? 'Office scan validated: correct destination'
          : 'Office scan validated: wrong destination',
      });

    console.log('[office-exit-scan] office_scan insert', { officeScanError });

    if (!officeScanError) {
      officeScanInserted = true;
    }

    const visitorName = `${visitor.first_name || ''} ${visitor.last_name || ''}`.trim();

    return jsonResponse({
      success: true,
      message: 'Visitor scan processed successfully.',
      errorCode: null,
      data: {
        visitId: Number(visit.visit_id),
        visitorId: Number(visitor.visitor_id),
        visitorName: visitorName || '(unknown visitor)',
        passNumber: visitor.pass_number || null,
        controlNumber: visitor.control_number || null,
        destinationOffice: destinationOffice?.office_name || null,
        expectedOffice: expectedOffice?.office_name || null,
        purposeReason: visit.purpose_reason || null,
        entryTime: visit.entry_time || null,
        registeredBy,
        isCorrectDestination,
        destinationStatusLabel,
        exitTime: exitTime.toISOString(),
        durationMinutes,
        exitStatusId,
        officeScanInserted,
      },
      debug: {
        lookupDebug,
        normalizedQr: lookup.normalized,
      },
    });
  } catch (error) {
    console.error('[office-exit-scan] unexpected failure', error);
    return jsonResponse({
      success: false,
      message: 'Unexpected server error while processing scan.',
      errorCode: 'UNEXPECTED_ERROR',
      data: null,
      debug: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
});
