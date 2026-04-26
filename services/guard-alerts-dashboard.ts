import { supabase } from '@/services/database/supabase';

export type ReadyToExitVisitor = {
  visitId: number;
  visitorId: number;
  name: string;
  detailLine: string;
  completedAt: string | null;
  completedAtLabel: string;
};

const WRONG_DESTINATION_ALERT_TYPES = ['Wrong Office', 'Unauthorized'] as const;

/**
 * Distinct open visits with a wrong-destination alert (`Unauthorized` from office scan, or legacy `Wrong Office`).
 * Multiple wrong scans for the same visit still count as one visit here.
 */
export async function fetchUnresolvedWrongDestinationVisitCount(): Promise<number> {
  const { data, error } = await supabase
    .from('alerts')
    .select('visit_id')
    .eq('status', 'Unresolved')
    .in('alert_type', [...WRONG_DESTINATION_ALERT_TYPES]);

  if (error) {
    console.error('guard-alerts-dashboard: wrong-destination visits', error);
    return 0;
  }
  const ids = new Set(
    (data ?? [])
      .map((r) => r.visit_id)
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id)),
  );
  return ids.size;
}

/**
 * Visits still open (`exit_time` null) where every `office_expectation` row has `arrived_at`
 * (route finished; guard can process exit at the gate).
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
    .select('visit_id, arrived_at')
    .in('visit_id', openVisitIds);

  if (expErr) {
    console.error('guard-alerts-dashboard: expectations', expErr);
    return [];
  }

  const byVisit = new Map<number, { arrived_at: string | null }[]>();
  for (const row of expectations ?? []) {
    const vid = row.visit_id as number;
    if (!Number.isFinite(vid)) continue;
    const list = byVisit.get(vid) ?? [];
    list.push({ arrived_at: row.arrived_at as string | null });
    byVisit.set(vid, list);
  }

  const readyVisitIds: number[] = [];
  for (const visitId of openVisitIds) {
    const rows = byVisit.get(visitId);
    if (!rows?.length) {
      continue;
    }
    if (rows.every((r) => r.arrived_at != null && String(r.arrived_at).trim() !== '')) {
      readyVisitIds.push(visitId);
    }
  }

  if (readyVisitIds.length === 0) {
    return [];
  }

  const lastArrivedByVisit = new Map<number, string>();
  for (const row of expectations ?? []) {
    const vid = row.visit_id as number;
    if (!readyVisitIds.includes(vid)) continue;
    const at = row.arrived_at as string | null;
    if (!at) continue;
    const prev = lastArrivedByVisit.get(vid);
    if (!prev || new Date(at).getTime() > new Date(prev).getTime()) {
      lastArrivedByVisit.set(vid, at);
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

export async function loadGuardAlertsDashboard(): Promise<{
  wrongDestinationVisitCount: number;
  readyToExitVisitors: ReadyToExitVisitor[];
}> {
  const [wrongDestinationVisitCount, readyToExitVisitors] = await Promise.all([
    fetchUnresolvedWrongDestinationVisitCount(),
    fetchReadyToExitVisitors(),
  ]);
  return { wrongDestinationVisitCount, readyToExitVisitors };
}
