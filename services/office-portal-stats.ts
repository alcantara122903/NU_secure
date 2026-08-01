/**
 * Live stats for the office staff portal (scoped to staff's office).
 */

import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database/supabase';
import { PH_TIME_ZONE } from '@/lib/supabase-timestamp-ph';

export type OfficePortalStats = {
  officeId: number;
  officeName: string;
  staffName: string;
  staffRole: string;
  todayVisitors: number;
  pendingScans: number;
  expectedVisitors: number;
};

function manilaDayBounds(): { startIso: string; endIso: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const day = dtf.format(new Date()); // YYYY-MM-DD
  return {
    startIso: `${day}T00:00:00+08:00`,
    endIso: `${day}T23:59:59.999+08:00`,
  };
}

export async function loadOfficePortalStats(): Promise<OfficePortalStats | null> {
  const userId = authSessionService.getCurrentUserId();
  if (userId == null) {
    return null;
  }

  const { data: staff, error: staffErr } = await supabase
    .from('office_staff')
    .select('office_id, position, office:office_id(office_id, office_name)')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffErr || staff?.office_id == null) {
    console.warn('[OfficePortalStats] office_staff lookup failed:', staffErr?.message);
    return null;
  }

  const officeId = Number(staff.office_id);
  const officeJoin = staff.office as
    | { office_id?: number; office_name?: string }
    | { office_id?: number; office_name?: string }[]
    | null;
  const officeRow = Array.isArray(officeJoin) ? officeJoin[0] : officeJoin;
  const officeName = officeRow?.office_name?.trim() || 'Office';
  const staffName =
    authSessionService.getCurrentUserFirstLastName() ||
    authSessionService.getSession()?.user?.email ||
    'Office Staff';
  const staffRole = (staff.position as string | null)?.trim() || 'Office Staff';

  const { startIso, endIso } = manilaDayBounds();

  // Today's Visitors: distinct visits scanned at this office today
  const { data: todayScans, error: todayErr } = await supabase
    .from('office_scan')
    .select('visit_id')
    .eq('office_id', officeId)
    .gte('scan_time', startIso)
    .lte('scan_time', endIso);

  if (todayErr) {
    console.warn('[OfficePortalStats] today scans error:', todayErr.message);
  }

  const todayVisitIds = new Set(
    (todayScans ?? [])
      .map((r) => r.visit_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  );

  // Pending / expected: expectations at this office not yet arrived, visit still on campus
  const { data: pendingRows, error: pendingErr } = await supabase
    .from('office_expectation')
    .select('expectation_id, visit_id, visit:visit_id(exit_time, entry_time)')
    .eq('office_id', officeId)
    .is('arrived_at', null);

  if (pendingErr) {
    console.warn('[OfficePortalStats] pending error:', pendingErr.message);
  }

  const activePending = (pendingRows ?? []).filter((row) => {
    const visitJoin = row.visit as
      | { exit_time?: string | null; entry_time?: string | null }
      | { exit_time?: string | null; entry_time?: string | null }[]
      | null;
    const visit = Array.isArray(visitJoin) ? visitJoin[0] : visitJoin;
    return visit != null && (visit.exit_time == null || visit.exit_time === '');
  });

  const expectedVisitIds = new Set(
    activePending
      .map((r) => r.visit_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  );

  return {
    officeId,
    officeName,
    staffName,
    staffRole,
    todayVisitors: todayVisitIds.size,
    pendingScans: activePending.length,
    expectedVisitors: expectedVisitIds.size,
  };
}
