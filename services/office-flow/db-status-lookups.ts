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

/** expectation_status_id when an office stop is completed / arrived. */
export async function resolveCompletedExpectationStatusId(): Promise<number | null> {
  const { data: rows } = await supabase
    .from('expectation_status')
    .select('expectation_status_id, status_name')
    .limit(40);
  if (!rows?.length) {
    return 4; // app convention fallback
  }
  const hit = rows.find((r) => {
    const n = norm(r.status_name);
    return (
      n.includes('complete') ||
      n.includes('arrived') ||
      n.includes('done') ||
      n.includes('checked') ||
      n.includes('finished')
    );
  });
  return hit?.expectation_status_id ?? rows[rows.length - 1]?.expectation_status_id ?? 4;
}
