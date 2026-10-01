import { supabase } from '@/services/database/supabase';

type ProgressRow = {
  progress_id: number;
  completed_at: string | null;
  step: {
    office_id: number;
    step_order: number;
    step_name: string | null;
    office_name: string | null;
  } | null;
};

/** PostgREST may type embedded `step` as an array; runtime is usually a single object. */
function normalizeEmbeddedStep(
  step: unknown,
): {
  office_id: number;
  step_order: number;
  step_name: string | null;
  office_name: string | null;
} | null {
  if (step == null) {
    return null;
  }
  const pick = (
    obj: Record<string, unknown>,
  ): {
    office_id: number;
    step_order: number;
    step_name: string | null;
    office_name: string | null;
  } | null => {
    const oid = obj.office_id;
    const ord = obj.step_order;
    if (typeof oid === 'number' && typeof ord === 'number') {
      const officeJoin = obj.office as
        | { office_name?: string | null }
        | { office_name?: string | null }[]
        | null
        | undefined;
      const officeObj = Array.isArray(officeJoin) ? officeJoin[0] : officeJoin;
      return {
        office_id: oid,
        step_order: ord,
        step_name: obj.step_name != null ? String(obj.step_name) : null,
        office_name:
          officeObj?.office_name != null ? String(officeObj.office_name) : null,
      };
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

/**
 * Optional enrollee stops stay on the 9-step route but may be skipped.
 * Match office name OR step label — DB step_name is often the task
 * ("Fitting and Payment of Uniform"), while the office is "Bulldogs Exchange".
 */
export function isOptionalEnrolleeStepName(label: string | null | undefined): boolean {
  const n = String(label || '')
    .trim()
    .toLowerCase();
  if (!n) return false;
  return (
    n.includes('bulldogs exchange') ||
    n.includes('bulldog exchange') ||
    /\bbulldogs?\b/.test(n)
  );
}

export function isOptionalEnrolleeStop(params: {
  stepName?: string | null;
  officeName?: string | null;
}): boolean {
  return (
    isOptionalEnrolleeStepName(params.officeName) ||
    isOptionalEnrolleeStepName(params.stepName)
  );
}

export function isOptionalEnrolleeProgressRow(row: ProgressRow): boolean {
  return isOptionalEnrolleeStop({
    stepName: row.step?.step_name,
    officeName: row.step?.office_name,
  });
}

const PROGRESS_SELECT = `
  progress_id,
  completed_at,
  step:enrollee_step(
    office_id,
    step_order,
    step_name,
    office:office_id(office_name)
  )
`;

async function loadEnrolleeIdForVisitor(visitorId: number): Promise<number | null> {
  const { data: enrollee } = await supabase
    .from('enrollee')
    .select('enrollee_id')
    .eq('visitor_id', visitorId)
    .maybeSingle();
  return enrollee?.enrollee_id != null ? Number(enrollee.enrollee_id) : null;
}

async function loadProgressRowsForVisitor(visitorId: number): Promise<ProgressRow[]> {
  const enrolleeId = await loadEnrolleeIdForVisitor(visitorId);
  if (enrolleeId == null) {
    return [];
  }
  const { data } = await supabase
    .from('enrollee_progress')
    .select(PROGRESS_SELECT)
    .eq('enrollee_id', enrolleeId);
  return mapQueryToProgressRows(data);
}

/**
 * Next office for routing / primary_office_id.
 * Prefers the next *required* incomplete step so optional Bulldogs Exchange
 * does not block advancing to ITSO after SDAO.
 * If only optional steps remain, returns the first optional office.
 */
export async function nextOfficeIdFromEnrolleeProgress(visitorId: number): Promise<number | null> {
  const rows = sortIncompleteByStepOrder(await loadProgressRowsForVisitor(visitorId));
  if (!rows.length) {
    return null;
  }
  const nextRequired = rows.find((r) => !isOptionalEnrolleeProgressRow(r));
  const pick = nextRequired ?? rows[0];
  const id = pick?.step?.office_id;
  return id != null ? Number(id) : null;
}

/**
 * Whether an enrollee may check in at `scanningOfficeId`.
 * Allowed when that office matches an incomplete step and every incomplete
 * step before it is optional (e.g. skip Bulldogs → scan at ITSO).
 */
export async function resolveEnrolleeCheckInAuthorization(
  visitorId: number,
  scanningOfficeId: number,
): Promise<{ authorized: boolean; expectedOfficeId: number | null }> {
  const rows = sortIncompleteByStepOrder(await loadProgressRowsForVisitor(visitorId));
  if (!rows.length) {
    return { authorized: false, expectedOfficeId: null };
  }

  const nextRequired = rows.find((r) => !isOptionalEnrolleeProgressRow(r));
  const guidanceOfficeId =
    nextRequired?.step?.office_id != null
      ? Number(nextRequired.step.office_id)
      : rows[0]?.step?.office_id != null
        ? Number(rows[0].step.office_id)
        : null;

  const targetsAtOffice = rows.filter(
    (r) => Number(r.step?.office_id) === Number(scanningOfficeId),
  );
  if (!targetsAtOffice.length) {
    return { authorized: false, expectedOfficeId: guidanceOfficeId };
  }

  const target = targetsAtOffice[0];
  const targetOrder = target.step?.step_order ?? 0;
  const requiredBlockers = rows.filter(
    (r) =>
      (r.step?.step_order ?? 0) < targetOrder && !isOptionalEnrolleeProgressRow(r),
  );
  if (requiredBlockers.length > 0) {
    const blockerOffice =
      requiredBlockers[0]?.step?.office_id != null
        ? Number(requiredBlockers[0].step.office_id)
        : guidanceOfficeId;
    return { authorized: false, expectedOfficeId: blockerOffice };
  }

  return { authorized: true, expectedOfficeId: Number(scanningOfficeId) };
}

/** True if enrollee still has an incomplete step at this office (e.g. Admissions step 9). */
export async function officeStillHasIncompleteEnrolleeSteps(
  visitorId: number,
  officeId: number,
): Promise<boolean> {
  const rows = sortIncompleteByStepOrder(await loadProgressRowsForVisitor(visitorId));
  return rows.some((p) => Number(p.step?.office_id) === Number(officeId));
}

export type CompleteEnrolleeProgressResult = {
  /** True when no required incomplete steps remain (optional leftovers do not block). */
  completedAllRequired: boolean;
  /** Office IDs whose optional steps were auto-skipped before completing the scanned office. */
  skippedOfficeIds: number[];
};

/**
 * Complete the enrollee step at the scanning office.
 * Auto-completes any optional incomplete steps that come before it
 * (e.g. Bulldogs Exchange when checking in at ITSO).
 */
export async function completeEnrolleeProgressAtOffice(
  visitorId: number,
  scanningOfficeId: number,
  completedAtIso: string,
  stepStatusId: number | null,
  enrolleeCompletedStatusId: number | null,
  skippedStepStatusId: number | null = null,
): Promise<CompleteEnrolleeProgressResult> {
  const empty: CompleteEnrolleeProgressResult = {
    completedAllRequired: false,
    skippedOfficeIds: [],
  };

  const enrolleeId = await loadEnrolleeIdForVisitor(visitorId);
  if (enrolleeId == null) {
    return empty;
  }

  const { data } = await supabase
    .from('enrollee_progress')
    .select(PROGRESS_SELECT)
    .eq('enrollee_id', enrolleeId);

  const rows = sortIncompleteByStepOrder(mapQueryToProgressRows(data));
  const target = rows.find((p) => Number(p.step?.office_id) === Number(scanningOfficeId));
  if (!target?.progress_id) {
    return empty;
  }

  const targetOrder = target.step?.step_order ?? 0;
  const optionalToSkip = rows.filter(
    (p) =>
      (p.step?.step_order ?? 0) < targetOrder &&
      isOptionalEnrolleeProgressRow(p) &&
      p.progress_id !== target.progress_id,
  );

  const skippedOfficeIds: number[] = [];
  for (const skipRow of optionalToSkip) {
    const skipStatus = skippedStepStatusId ?? stepStatusId;
    await supabase
      .from('enrollee_progress')
      .update({
        completed_at: completedAtIso,
        ...(skipStatus != null ? { step_status_id: skipStatus } : {}),
      })
      .eq('progress_id', skipRow.progress_id);
    if (skipRow.step?.office_id != null) {
      skippedOfficeIds.push(Number(skipRow.step.office_id));
    }
  }

  await supabase
    .from('enrollee_progress')
    .update({
      completed_at: completedAtIso,
      ...(stepStatusId != null ? { step_status_id: stepStatusId } : {}),
    })
    .eq('progress_id', target.progress_id);

  const { data: remaining } = await supabase
    .from('enrollee_progress')
    .select(PROGRESS_SELECT)
    .eq('enrollee_id', enrolleeId);

  const remainingIncomplete = sortIncompleteByStepOrder(mapQueryToProgressRows(remaining));
  const hasIncompleteRequired = remainingIncomplete.some(
    (r) => !isOptionalEnrolleeProgressRow(r),
  );

  // If only optional steps remain after finishing required work, auto-complete them
  // so the 9-step route can finish cleanly without forcing Bulldogs Exchange.
  if (!hasIncompleteRequired && remainingIncomplete.length > 0) {
    const skipStatus = skippedStepStatusId ?? stepStatusId;
    for (const leftover of remainingIncomplete) {
      if (!isOptionalEnrolleeProgressRow(leftover)) continue;
      await supabase
        .from('enrollee_progress')
        .update({
          completed_at: completedAtIso,
          ...(skipStatus != null ? { step_status_id: skipStatus } : {}),
        })
        .eq('progress_id', leftover.progress_id);
      if (leftover.step?.office_id != null) {
        skippedOfficeIds.push(Number(leftover.step.office_id));
      }
    }
  }

  const completedAllRequired = !hasIncompleteRequired;

  await supabase
    .from('enrollee')
    .update({
      updated_at: completedAtIso,
      ...(completedAllRequired && enrolleeCompletedStatusId != null
        ? { enrollee_status_id: enrolleeCompletedStatusId }
        : {}),
    })
    .eq('enrollee_id', enrolleeId);

  return {
    completedAllRequired,
    skippedOfficeIds: Array.from(new Set(skippedOfficeIds)),
  };
}
