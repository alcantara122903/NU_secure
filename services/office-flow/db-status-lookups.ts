import { supabase } from '@/services/database/supabase';

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase();

/**
 * Picks validation_status_id from the database by matching status_name heuristics.
 * Used for office_scan rows (check-in and exit flows).
 */
export async function resolveValidationStatusId(options: { favorable: boolean }): Promise<number | null> {
  const { data: rows } = await supabase.from('validation_status').select('validation_status_id, status_name').limit(40);
  if (!rows?.length) {
    return null;
  }
  const positive = ['correct', 'valid', 'approved', 'authorized'];
  const negative = ['wrong', 'invalid', 'rejected', 'unauthorized', 'denied'];
  const keys = options.favorable ? positive : negative;
  const hit = rows.find((r) => keys.some((k) => norm(r.status_name).includes(k)));
  return hit?.validation_status_id ?? rows[0].validation_status_id;
}

/** step_status_id for marking an enrollee_progress row completed. */
export async function resolveCompletedStepStatusId(): Promise<number | null> {
  const { data: rows } = await supabase.from('step_status').select('step_status_id, step_status_name').limit(40);
  if (!rows?.length) {
    return null;
  }
  const hit = rows.find((r) => {
    const n = norm(r.step_status_name);
    return n.includes('complete') || n.includes('done') || n.includes('finished');
  });
  return hit?.step_status_id ?? rows[0].step_status_id;
}

/** enrollee_status_id for marking an enrollee as fully completed. */
export async function resolveCompletedEnrolleeStatusId(): Promise<number | null> {
  const { data: rows } = await supabase
    .from('enrollee_status')
    .select('enrollee_status_id, status_name')
    .limit(40);
  if (!rows?.length) {
    return null;
  }
  const hit = rows.find((r) => {
    const n = norm(r.status_name);
    return n.includes('complete') || n.includes('done') || n.includes('finished');
  });
  return hit?.enrollee_status_id ?? rows[0].enrollee_status_id;
}

type ExpectationStatusRow = { expectation_status_id: number; status_name: string | null };

async function loadExpectationStatuses(): Promise<ExpectationStatusRow[]> {
  const { data: rows } = await supabase
    .from('expectation_status')
    .select('expectation_status_id, status_name')
    .limit(40);
  return (rows ?? []) as ExpectationStatusRow[];
}

function matchExpectationStatus(
  rows: ExpectationStatusRow[],
  keys: string[],
  fallbackId: number,
): number {
  const hit = rows.find((r) => keys.some((k) => norm(r.status_name).includes(k)));
  return hit?.expectation_status_id ?? fallbackId;
}

/** Pending / expected (not yet arrived). App convention fallback: 1 */
export async function resolvePendingExpectationStatusId(): Promise<number> {
  const rows = await loadExpectationStatuses();
  if (!rows.length) return 1;
  return matchExpectationStatus(rows, ['pending', 'expected', 'waiting', 'open', 'active'], 1);
}

/**
 * Completed / checked-in at office.
 * Prefer "complete/done/checked/finished" over bare "arrived" so we don't pick a
 * distinct Arrived row when Completed also exists. Fallback: 4
 */
export async function resolveCompletedExpectationStatusId(): Promise<number> {
  const rows = await loadExpectationStatuses();
  if (!rows.length) return 4;
  const preferred = rows.find((r) => {
    const n = norm(r.status_name);
    return (
      n.includes('complete') ||
      n.includes('done') ||
      n.includes('checked') ||
      n.includes('finished')
    );
  });
  if (preferred) return preferred.expectation_status_id;
  const arrived = rows.find((r) => norm(r.status_name).includes('arrived'));
  return arrived?.expectation_status_id ?? rows[rows.length - 1]?.expectation_status_id ?? 4;
}

/** Skipped when visitor exits before visiting remaining offices. Fallback: 3 */
export async function resolveSkippedExpectationStatusId(): Promise<number> {
  const rows = await loadExpectationStatuses();
  if (!rows.length) return 3;
  return matchExpectationStatus(rows, ['skip', 'cancel', 'abort', 'bypass'], 3);
}
