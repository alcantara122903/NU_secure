import { supabase } from '@/services/database/supabase';

type ProgressRow = {
  progress_id: number;
  completed_at: string | null;
  step: { office_id: number; step_order: number } | null;
};

/** PostgREST may type embedded `step` as an array; runtime is usually a single object. */
function normalizeEmbeddedStep(step: unknown): { office_id: number; step_order: number } | null {
  if (step == null) {
    return null;
  }
  const pick = (obj: Record<string, unknown>): { office_id: number; step_order: number } | null => {
    const oid = obj.office_id;
    const ord = obj.step_order;
    if (typeof oid === 'number' && typeof ord === 'number') {
      return { office_id: oid, step_order: ord };
    }
    return null;
  };
  if (Array.isArray(step)) {
    const first = step[0];
    return first && typeof first === 'object' ? pick(first as Record<string, unknown>) : null;
  }
  if (typeof step === 'object') {
    return pick(step as Record<string, unknown>);
  }
  return null;
}

function mapQueryToProgressRows(data: unknown): ProgressRow[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map((row) => {
    const r = row as { progress_id?: unknown; completed_at?: string | null; step?: unknown };
    return {
      progress_id: Number(r.progress_id),
      completed_at: r.completed_at ?? null,
      step: normalizeEmbeddedStep(r.step),
    };
  });
}

function sortIncompleteByStepOrder(rows: ProgressRow[]): ProgressRow[] {
  return rows
    .filter((r) => !r.completed_at)
    .slice()
    .sort((a, b) => (a.step?.step_order ?? 0) - (b.step?.step_order ?? 0));
}

/** Next office for an enrollee when office_expectation rows are missing or exhausted. */
export async function nextOfficeIdFromEnrolleeProgress(visitorId: number): Promise<number | null> {
  const { data: enrollee } = await supabase
    .from('enrollee')
    .select('enrollee_id')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  if (!enrollee?.enrollee_id) {
    return null;
  }

  const { data } = await supabase
    .from('enrollee_progress')
    .select(
      `
      progress_id,
      completed_at,
      step:enrollee_step(office_id, step_order)
    `,
    )
    .eq('enrollee_id', enrollee.enrollee_id);

  const rows = sortIncompleteByStepOrder(mapQueryToProgressRows(data));
  const id = rows[0]?.step?.office_id;
  return id != null ? Number(id) : null;
}

export async function completeEnrolleeProgressAtOffice(
  visitorId: number,
  scanningOfficeId: number,
  completedAtIso: string,
  stepStatusId: number | null,
): Promise<void> {
  const { data: enrollee } = await supabase
    .from('enrollee')
    .select('enrollee_id')
    .eq('visitor_id', visitorId)
    .maybeSingle();

  if (!enrollee?.enrollee_id) {
    return;
  }

  const { data } = await supabase
    .from('enrollee_progress')
    .select(
      `
      progress_id,
      completed_at,
      step:enrollee_step(office_id, step_order)
    `,
    )
    .eq('enrollee_id', enrollee.enrollee_id);

  const rows = sortIncompleteByStepOrder(mapQueryToProgressRows(data));
  const target = rows.find((p) => Number(p.step?.office_id) === Number(scanningOfficeId));
  if (!target?.progress_id) {
    return;
  }

  await supabase
    .from('enrollee_progress')
    .update({
      completed_at: completedAtIso,
      ...(stepStatusId != null ? { step_status_id: stepStatusId } : {}),
    })
    .eq('progress_id', target.progress_id);

  await supabase.from('enrollee').update({ updated_at: completedAtIso }).eq('enrollee_id', enrollee.enrollee_id);
}
