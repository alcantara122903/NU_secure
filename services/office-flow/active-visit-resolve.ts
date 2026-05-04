import { extractLooseQrScanFields, parseQrTicketRaw } from '@/lib/qr-ticket-payload';
import { supabase } from '@/services/database/supabase';

export type ActiveVisitRow = {
  visit_id: number;
  visitor_id: number;
  visit_type_id: number | null;
  primary_office_id: number | null;
  qr_token: string | null;
  purpose_reason: string | null;
  guard_user_id: number | null;
  entry_time: string | null;
  exit_time: string | null;
};

const VISIT_SELECT =
  'visit_id, visitor_id, visit_type_id, primary_office_id, qr_token, purpose_reason, guard_user_id, entry_time, exit_time';

function uniqueNonEmptyStrings(values: (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    const s = (v ?? '').trim();
    if (!s || seen.has(s)) {
      continue;
    }
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * Resolves the single active visit (exit_time is null) from a QR scan string:
 * v1 ticket JSON, loose web JSON (qr_token / visit_id / control_number / pass_number / visitor_id),
 * pipe-delimited or URL-encoded payloads, then plain qr_token — aligned with exit scan resolution.
 */
export async function resolveActiveVisitFromScanInput(rawQrValue: string): Promise<ActiveVisitRow | null> {
  const trimmed = rawQrValue.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parseQrTicketRaw(trimmed);
  const loose = extractLooseQrScanFields(trimmed);

  const visitIdForCompound = parsed.payload?.visit_id ?? loose.visit_id ?? null;
  const qrTokenForCompound = parsed.payload != null ? parsed.qr_token : loose.qr_token;

  let visit: ActiveVisitRow | null = null;

  if (visitIdForCompound != null && qrTokenForCompound) {
    const { data } = await supabase
      .from('visit')
      .select(VISIT_SELECT)
      .eq('visit_id', visitIdForCompound)
      .eq('qr_token', qrTokenForCompound)
      .is('exit_time', null)
      .maybeSingle();
    visit = data as ActiveVisitRow | null;
  }

  if (!visit && loose.visit_id != null && !loose.qr_token?.trim() && !parsed.payload) {
    const { data } = await supabase
      .from('visit')
      .select(VISIT_SELECT)
      .eq('visit_id', loose.visit_id)
      .is('exit_time', null)
      .maybeSingle();
    visit = data as ActiveVisitRow | null;
  }

  if (!visit && loose.visitor_id != null) {
    const { data } = await supabase
      .from('visit')
      .select(VISIT_SELECT)
      .eq('visitor_id', loose.visitor_id)
      .is('exit_time', null)
      .order('entry_time', { ascending: false })
      .limit(1)
      .maybeSingle();
    visit = data as ActiveVisitRow | null;
  }

  const junkFullJsonAsToken =
    trimmed.startsWith('{') &&
    parsed.payload == null &&
    (!loose.qr_token?.trim() || loose.qr_token === trimmed);

  const stringCandidates = uniqueNonEmptyStrings([
    parsed.payload ? parsed.qr_token : null,
    loose.qr_token,
    loose.control_number,
    loose.pass_number,
    ...loose.qr_parts,
    !junkFullJsonAsToken ? parsed.qr_token : null,
    !junkFullJsonAsToken ? trimmed : null,
  ]);

  for (const token of stringCandidates) {
    if (visit) {
      break;
    }

    const { data: byToken } = await supabase
      .from('visit')
      .select(VISIT_SELECT)
      .eq('qr_token', token)
      .is('exit_time', null)
      .maybeSingle();
    visit = byToken as ActiveVisitRow | null;

    if (visit) {
      break;
    }

    let resolvedVisitorId: number | undefined;
    const { data: byControl } = await supabase
      .from('visitor')
      .select('visitor_id')
      .eq('control_number', token)
      .maybeSingle();
    resolvedVisitorId = byControl?.visitor_id;

    if (resolvedVisitorId == null) {
      const { data: byPass } = await supabase
        .from('visitor')
        .select('visitor_id')
        .eq('pass_number', token)
        .maybeSingle();
      resolvedVisitorId = byPass?.visitor_id ?? undefined;
    }

    if (resolvedVisitorId != null) {
      const { data } = await supabase
        .from('visit')
        .select(VISIT_SELECT)
        .eq('visitor_id', resolvedVisitorId)
        .is('exit_time', null)
        .order('entry_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      visit = data as ActiveVisitRow | null;
    }
  }

  return visit;
}
