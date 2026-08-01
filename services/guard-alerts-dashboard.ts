import { supabase } from '@/services/database/supabase';

export type ReadyToExitVisitor = {
  visitId: number;
  visitorId: number;
  name: string;
  detailLine: string;
  completedAt: string | null;
  completedAtLabel: string;
};

export type UnresolvedWrongDestinationAlert = {
  alertId: number;
  visitId: number;
  visitorId: number;
  visitorName: string;
  passNumber: string;
  controlNumber: string;
  scannedOfficeName: string;
  message: string;
  createdAt: string | null;
  createdAtLabel: string;
};

const WRONG_DESTINATION_ALERT_TYPES = ['Wrong Office', 'Unauthorized'] as const;

/** Terminal `office_expectation.expectation_status_id` values (no pending offices). */
const EXPECTATION_SKIPPED = 3;
const EXPECTATION_COMPLETED = 4;

/**
 * All unresolved wrong-destination / unauthorized alerts (every alert row).
 * Not limited to active visits so the summary matches the full alerts list.
 */
export async function fetchUnresolvedWrongDestinationVisitCount(): Promise<number> {
  const { count, error } = await supabase
    .from('alerts')
    .select('alert_id', { count: 'exact', head: true })
    .eq('status', 'Unresolved')
    .in('alert_type', [...WRONG_DESTINATION_ALERT_TYPES]);

  if (error) {
    console.error('guard-alerts-dashboard: wrong-destination alert count', error);
    return 0;
  }

  return typeof count === 'number' && Number.isFinite(count) ? count : 0;
}

/**
 * Visits still open (`exit_time` null) where every `office_expectation` row is terminal:
 * completed at destination (`expectation_status_id` 4) or skipped (`3`) — no pending offices.
 */
export async function fetchReadyToExitVisitors(): Promise<ReadyToExitVisitor[]> {
  const { data: openVisits, error: openErr } = await supabase
    .from('visit')
    .select('visit_id')
    .is('exit_time', null);

  if (openErr) {
    console.error('guard-alerts-dashboard: open visits', openErr);
    return [];
  }

  const openVisitIds = (openVisits ?? []).map((v) => v.visit_id as number).filter(Number.isFinite);
  if (openVisitIds.length === 0) {
    return [];
  }

  const { data: expectations, error: expErr } = await supabase
    .from('office_expectation')
    .select('visit_id, arrived_at, expectation_status_id, created_at')
    .in('visit_id', openVisitIds);

  if (expErr) {
    console.error('guard-alerts-dashboard: expectations', expErr);
    return [];
  }

  type ExpectationRow = {
    arrived_at: string | null;
    expectation_status_id: number | null;
    created_at: string | null;
  };

  const byVisit = new Map<number, ExpectationRow[]>();
  for (const row of expectations ?? []) {
    const vid = row.visit_id as number;
    if (!Number.isFinite(vid)) continue;
    const list = byVisit.get(vid) ?? [];
    list.push({
      arrived_at: row.arrived_at as string | null,
      expectation_status_id:
        typeof row.expectation_status_id === 'number' && Number.isFinite(row.expectation_status_id)
          ? row.expectation_status_id
          : null,
      created_at: row.created_at as string | null,
    });
    byVisit.set(vid, list);
  }

  const rowTerminal = (r: ExpectationRow): boolean => {
    // Prefer arrived_at (source of truth for check-in); status ids are secondary
    if (r.arrived_at != null && String(r.arrived_at).trim() !== '') {
      return true;
    }
    return (
      r.expectation_status_id === EXPECTATION_COMPLETED ||
      r.expectation_status_id === EXPECTATION_SKIPPED
    );
  };

  const rowSortTime = (r: ExpectationRow): string | null => {
    const a = r.arrived_at != null && String(r.arrived_at).trim() !== '' ? String(r.arrived_at).trim() : null;
    const c = r.created_at != null && String(r.created_at).trim() !== '' ? String(r.created_at).trim() : null;
    return a ?? c;
  };

  const readyVisitIds: number[] = [];
  for (const visitId of openVisitIds) {
    const rows = byVisit.get(visitId);
    if (!rows?.length) {
      continue;
    }
    if (rows.every(rowTerminal)) {
      readyVisitIds.push(visitId);
    }
  }

  if (readyVisitIds.length === 0) {
    return [];
  }

  const lastArrivedByVisit = new Map<number, string>();
  for (const visitId of readyVisitIds) {
    const rows = byVisit.get(visitId);
    if (!rows?.length) continue;
    let best: string | null = null;
    for (const r of rows) {
      const t = rowSortTime(r);
      if (!t) continue;
      if (!best || new Date(t).getTime() > new Date(best).getTime()) {
        best = t;
      }
    }
    if (best) {
      lastArrivedByVisit.set(visitId, best);
    }
  }

  const { data: visitRows, error: visitErr } = await supabase
    .from('visit')
    .select('visit_id, visitor_id, purpose_reason, destination_text, primary_office_id')
    .in('visit_id', readyVisitIds);

  if (visitErr || !visitRows?.length) {
    console.error('guard-alerts-dashboard: visit rows', visitErr);
    return [];
  }

  const visitorIds = [...new Set(visitRows.map((v) => v.visitor_id as number).filter(Number.isFinite))];
  const { data: visitorRows } = await supabase
    .from('visitor')
    .select('visitor_id, first_name, last_name, pass_number, control_number')
    .in('visitor_id', visitorIds);

  const visitorById = new Map(
    (visitorRows ?? []).map((r) => [
      r.visitor_id as number,
      {
        first_name: r.first_name as string | null,
        last_name: r.last_name as string | null,
        pass_number: r.pass_number as string | null,
        control_number: r.control_number as string | null,
      },
    ]),
  );

  const officeIds = [
    ...new Set(
      visitRows.map((v) => v.primary_office_id as number | null).filter((id): id is number => id != null && Number.isFinite(id)),
    ),
  ];
  let officeNameById = new Map<number, string>();
  if (officeIds.length > 0) {
    const { data: offices } = await supabase.from('office').select('office_id, office_name').in('office_id', officeIds);
    officeNameById = new Map((offices ?? []).map((o) => [o.office_id as number, String(o.office_name ?? '')]));
  }

  const formatCompletedLabel = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  const result: ReadyToExitVisitor[] = visitRows.map((v) => {
    const visitId = v.visit_id as number;
    const visitorId = v.visitor_id as number;
    const vis = visitorById.get(visitorId) ?? {
      first_name: null as string | null,
      last_name: null as string | null,
      pass_number: null as string | null,
      control_number: null as string | null,
    };
    const first = vis?.first_name?.trim() ?? '';
    const last = vis?.last_name?.trim() ?? '';
    const name = [first, last].filter(Boolean).join(' ') || 'Visitor';
    const control = vis?.control_number?.trim();
    const pass = vis?.pass_number?.trim();
    const idPart = control || pass || '—';
    const purpose = (v.purpose_reason as string | null)?.trim();
    const destText = (v.destination_text as string | null)?.trim();
    const primaryName = v.primary_office_id != null ? officeNameById.get(v.primary_office_id as number) : undefined;
    const deptPart = purpose || destText || primaryName || 'Visit';
    const detailLine = `${deptPart} • ${idPart}`;
    const completedAt = lastArrivedByVisit.get(visitId) ?? null;
    return {
      visitId,
      visitorId,
      name,
      detailLine,
      completedAt,
      completedAtLabel: formatCompletedLabel(completedAt),
    };
  });

  result.sort((a, b) => {
    const ta = a.completedAt ? new Date(a.completedAt).getTime() : 0;
    const tb = b.completedAt ? new Date(b.completedAt).getTime() : 0;
    return tb - ta;
  });

  return result;
}

export async function fetchUnresolvedWrongDestinationAlerts(): Promise<UnresolvedWrongDestinationAlert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('alert_id, visit_id, visitor_id, scan_id, message, created_at')
    .eq('status', 'Unresolved')
    .in('alert_type', [...WRONG_DESTINATION_ALERT_TYPES])
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('guard-alerts-dashboard: unresolved wrong-destination alerts', error);
    return [];
  }

  const alertRows =
    (data ?? []).filter(
      (r): r is {
        alert_id: number;
        visit_id: number;
        visitor_id: number;
        scan_id: number | null;
        message: string | null;
        created_at: string | null;
      } =>
        typeof r.alert_id === 'number' &&
        Number.isFinite(r.alert_id) &&
        typeof r.visit_id === 'number' &&
        Number.isFinite(r.visit_id) &&
        typeof r.visitor_id === 'number' &&
        Number.isFinite(r.visitor_id),
    );

  if (alertRows.length === 0) return [];

  const openAlerts = alertRows;

  const visitorIds = [...new Set(openAlerts.map((r) => r.visitor_id))];
  const { data: visitors } = await supabase
    .from('visitor')
    .select('visitor_id, first_name, last_name, pass_number, control_number')
    .in('visitor_id', visitorIds);
  const visitorById = new Map(
    (visitors ?? []).map((v) => [
      v.visitor_id as number,
      {
        first: String(v.first_name ?? '').trim(),
        last: String(v.last_name ?? '').trim(),
        pass: String(v.pass_number ?? '').trim(),
        control: String(v.control_number ?? '').trim(),
      },
    ]),
  );

  const scanIds = [...new Set(openAlerts.map((r) => r.scan_id).filter((id): id is number => typeof id === 'number'))];
  const { data: scans } =
    scanIds.length > 0
      ? await supabase.from('office_scan').select('scan_id, office_id').in('scan_id', scanIds)
      : { data: [] as Array<{ scan_id: number; office_id: number | null }> };
  const officeIds = [
    ...new Set((scans ?? []).map((s) => s.office_id).filter((id): id is number => typeof id === 'number')),
  ];
  const { data: offices } =
    officeIds.length > 0
      ? await supabase.from('office').select('office_id, office_name').in('office_id', officeIds)
      : { data: [] as Array<{ office_id: number; office_name: string | null }> };

  const officeNameById = new Map((offices ?? []).map((o) => [o.office_id as number, String(o.office_name ?? '').trim()]));
  const scanOfficeByScanId = new Map((scans ?? []).map((s) => [s.scan_id as number, s.office_id as number | null]));

  const formatDateTime = (iso: string | null): string => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return openAlerts.map((a) => {
    const vis = visitorById.get(a.visitor_id);
    const visitorName = [vis?.first, vis?.last].filter(Boolean).join(' ') || 'Visitor';
    const officeId = a.scan_id != null ? scanOfficeByScanId.get(a.scan_id) ?? null : null;
    const scannedOfficeName = officeId != null ? officeNameById.get(officeId) || 'Unknown office' : 'Unknown office';

    return {
      alertId: a.alert_id,
      visitId: a.visit_id,
      visitorId: a.visitor_id,
      visitorName,
      passNumber: vis?.pass || '',
      controlNumber: vis?.control || '',
      scannedOfficeName,
      message: String(a.message ?? '').trim() || 'Wrong destination alert',
      createdAt: a.created_at,
      createdAtLabel: formatDateTime(a.created_at),
    };
  });
}

export async function loadGuardAlertsDashboard(): Promise<{
  wrongDestinationVisitCount: number;
  readyToExitVisitors: ReadyToExitVisitor[];
  unresolvedWrongDestinationAlerts: UnresolvedWrongDestinationAlert[];
}> {
  const [wrongDestinationVisitCount, readyToExitVisitors, unresolvedWrongDestinationAlerts] = await Promise.all([
    fetchUnresolvedWrongDestinationVisitCount(),
    fetchReadyToExitVisitors(),
    fetchUnresolvedWrongDestinationAlerts(),
  ]);
  return { wrongDestinationVisitCount, readyToExitVisitors, unresolvedWrongDestinationAlerts };
}
