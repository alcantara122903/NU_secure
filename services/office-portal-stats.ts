/**
 * Live stats for the office staff portal (scoped to the signed-in staff's office).
 *
 * - Today's Visitors: distinct visits with an office_scan at this office today (Manila).
 * - Pending Scans: open visits still due at this office (any order for normal visitors).
 * - Expected Visitors: open visits that still have any unarrived expectation at this office.
 */

import { PH_TIME_ZONE } from '@/lib/supabase-timestamp-ph';
import { authSessionService } from '@/services/auth-session';
import { supabase } from '@/services/database/supabase';

export type OfficePortalStats = {
  officeId: number;
  officeName: string;
  staffName: string;
  staffRole: string;
  todayVisitors: number;
  pendingScans: number;
  expectedVisitors: number;
};

/** Manila civil-day bounds as naive timestamps (matches `timestamp without time zone` columns). */
function manilaDayBoundsNaive(): { start: string; end: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const day = dtf.format(new Date()); // YYYY-MM-DD
  return {
    start: `${day}T00:00:00`,
    end: `${day}T23:59:59.999`,
  };
}

function asPositiveInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function unwrapOfficeJoin(
  office: unknown,
): { office_id?: number; office_name?: string } | null {
  if (office == null) return null;
  if (Array.isArray(office)) {
    return (office[0] as { office_id?: number; office_name?: string } | undefined) ?? null;
  }
  return office as { office_id?: number; office_name?: string };
}

export async function loadOfficePortalStats(): Promise<OfficePortalStats | null> {
  const userId = authSessionService.getCurrentUserId();
  if (userId == null) {
    console.warn('[OfficePortalStats] no signed-in user');
    return null;
  }

  const { data: staff, error: staffErr } = await supabase
    .from('office_staff')
    .select('office_id, position, office:office_id(office_id, office_name)')
    .eq('user_id', userId)
    .maybeSingle();

  if (staffErr) {
    console.warn('[OfficePortalStats] office_staff lookup failed:', staffErr.message);
    return null;
  }

  const officeId = asPositiveInt(staff?.office_id);
  if (officeId == null) {
    console.warn('[OfficePortalStats] staff has no office_id for user', userId);
    return null;
  }

  const officeRow = unwrapOfficeJoin(staff?.office);
  const officeName = officeRow?.office_name?.trim() || 'Office';
  const staffName =
    authSessionService.getCurrentUserFirstLastName() ||
    authSessionService.getSession()?.user?.email ||
    'Office Staff';
  const staffRole = (staff?.position as string | null)?.trim() || 'Office Staff';

  const { start, end } = manilaDayBoundsNaive();

  // --- Today's Visitors: distinct visits scanned here today ---
  const { data: todayScans, error: todayErr } = await supabase
    .from('office_scan')
    .select('visit_id')
    .eq('office_id', officeId)
    .gte('scan_time', start)
    .lte('scan_time', end);

  if (todayErr) {
    console.warn('[OfficePortalStats] today scans error:', todayErr.message);
  }

  const todayVisitIds = new Set<number>();
  for (const row of todayScans ?? []) {
    const id = asPositiveInt(row.visit_id);
    if (id != null) todayVisitIds.add(id);
  }

  // --- Expectations still open at this office ---
  const { data: pendingAtOffice, error: pendingErr } = await supabase
    .from('office_expectation')
    .select('expectation_id, visit_id, expected_order, office_id')
    .eq('office_id', officeId)
    .is('arrived_at', null);

  if (pendingErr) {
    console.warn('[OfficePortalStats] pending expectations error:', pendingErr.message);
  }

  const candidateVisitIds = [
    ...new Set(
      (pendingAtOffice ?? [])
        .map((r) => asPositiveInt(r.visit_id))
        .filter((id): id is number => id != null),
    ),
  ];

  const openVisitIds = new Set<number>();
  if (candidateVisitIds.length > 0) {
    const { data: openVisits, error: visitErr } = await supabase
      .from('visit')
      .select('visit_id')
      .in('visit_id', candidateVisitIds)
      .is('exit_time', null);

    if (visitErr) {
      console.warn('[OfficePortalStats] open visits error:', visitErr.message);
    }
    for (const v of openVisits ?? []) {
      const id = asPositiveInt(v.visit_id);
      if (id != null) openVisitIds.add(id);
    }
  }

  const openPendingAtOffice = (pendingAtOffice ?? []).filter((r) => {
    const id = asPositiveInt(r.visit_id);
    return id != null && openVisitIds.has(id);
  });

  const expectedVisitIds = new Set<number>();
  for (const row of openPendingAtOffice) {
    const id = asPositiveInt(row.visit_id);
    if (id != null) expectedVisitIds.add(id);
  }

  // Normal visitors may visit selected offices in any order — count all open
  // expectations at this office, not only visits whose "next" stop is here.
  const pendingScans = expectedVisitIds.size;

  return {
    officeId,
    officeName,
    staffName,
    staffRole,
    todayVisitors: todayVisitIds.size,
    pendingScans,
    expectedVisitors: expectedVisitIds.size,
  };
}
