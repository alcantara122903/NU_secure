import { parseQrTicketRaw } from '@/lib/qr-ticket-payload';
import { supabase } from '@/services/database/supabase';

export type ActiveVisitRow = {
  visit_id: number;
  visitor_id: number;
  visit_type_id: number | null;
  primary_office_id: number | null;
  qr_token: string | null;
  entry_time: string | null;
  exit_time: string | null;
};

const VISIT_SELECT =
  'visit_id, visitor_id, visit_type_id, primary_office_id, qr_token, entry_time, exit_time';

/**
 * Resolves the single active visit (exit_time is null) from a QR scan string:
 * structured payload + token match, plain qr_token, or visitor control/pass number.
 */
export async function resolveActiveVisitFromScanInput(rawQrValue: string): Promise<ActiveVisitRow | null> {
  const parsed = parseQrTicketRaw(rawQrValue.trim());
  const token = parsed.qr_token;
  if (!token) {
    return null;
  }

  let visit: ActiveVisitRow | null = null;

  if (parsed.payload != null) {
    const { data } = await supabase
      .from('visit')
      .select(VISIT_SELECT)
      .eq('visit_id', parsed.payload.visit_id)
      .eq('qr_token', token)
      .is('exit_time', null)
      .maybeSingle();
    visit = data as ActiveVisitRow | null;
  }

  if (!visit) {
    const { data } = await supabase
      .from('visit')
      .select(VISIT_SELECT)
      .eq('qr_token', token)
      .is('exit_time', null)
      .maybeSingle();
    visit = data as ActiveVisitRow | null;
  }

  if (!visit) {
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
