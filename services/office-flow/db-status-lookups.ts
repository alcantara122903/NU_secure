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
