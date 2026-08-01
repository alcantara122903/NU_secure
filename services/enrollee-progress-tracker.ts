/**
 * Load enrollee visit progress by qr_token for the public tracker page.
 */

import { buildEnrolleeProgressUrl } from '@/lib/enrollee-progress-url';
import { supabase } from '@/services/database/supabase';

export type EnrolleeRouteStepStatus = 'done' | 'current' | 'pending';

export type EnrolleeRouteStep = {
  stepId: number;
  stepOrder: number;
  stepName: string;
  officeId: number | null;
  officeName: string;
  completedAt: string | null;
  status: EnrolleeRouteStepStatus;
};

export type EnrolleeProgressTrackerData = {
  qrToken: string;
  visitId: number;
  visitorId: number;
  visitorName: string;
  passNumber: string;
  controlNumber: string | null;
  progressUrl: string;
  steps: EnrolleeRouteStep[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  currentOfficeName: string | null;
  remainingCount: number;
  isFullyComplete: boolean;
};

export async function loadEnrolleeProgressByQrToken(
  qrTokenRaw: string,
): Promise<EnrolleeProgressTrackerData | null> {
  const qrToken = qrTokenRaw.trim();
  if (!qrToken) {
    return null;
  }

  const { data: visit, error: visitErr } = await supabase
    .from('visit')
    .select('visit_id, visitor_id, qr_token, visit_type_id, exit_time')
    .eq('qr_token', qrToken)
    .order('entry_time', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (visitErr || !visit?.visit_id || !visit.visitor_id) {
    console.warn('[EnrolleeProgress] visit lookup failed:', visitErr?.message);
    return null;
  }

  const { data: visitor } = await supabase
    .from('visitor')
    .select('visitor_id, first_name, last_name, pass_number, control_number')
    .eq('visitor_id', visit.visitor_id)
    .maybeSingle();

  const visitorName =
    `${visitor?.first_name || ''} ${visitor?.last_name || ''}`.trim() || 'Visitor';
  const passNumber = String(visitor?.pass_number ?? '').trim() || '—';
  const controlNumber = visitor?.control_number ? String(visitor.control_number) : null;

  const { data: enrollee } = await supabase
    .from('enrollee')
    .select('enrollee_id')
    .eq('visitor_id', visit.visitor_id)
    .maybeSingle();

  let steps: EnrolleeRouteStep[] = [];

  if (enrollee?.enrollee_id) {
    const { data: progressRows } = await supabase
      .from('enrollee_progress')
      .select(
        `
        progress_id,
        completed_at,
        step:enrollee_step(
          step_id,
          step_name,
          step_order,
          office_id,
          office:office_id(office_name)
        )
      `,
      )
      .eq('enrollee_id', enrollee.enrollee_id);

    const mapped = (progressRows ?? [])
      .map((row) => {
        const stepJoin = row.step as
          | {
              step_id?: number;
              step_name?: string;
              step_order?: number;
              office_id?: number | null;
              office?: { office_name?: string } | { office_name?: string }[] | null;
            }
          | {
              step_id?: number;
              step_name?: string;
              step_order?: number;
              office_id?: number | null;
              office?: { office_name?: string } | { office_name?: string }[] | null;
            }[]
          | null;
        const step = Array.isArray(stepJoin) ? stepJoin[0] : stepJoin;
        if (!step?.step_id) {
          return null;
        }
        const officeJoin = step.office;
        const office = Array.isArray(officeJoin) ? officeJoin[0] : officeJoin;
        const officeName =
          office?.office_name?.trim() ||
          step.step_name?.trim() ||
          `Office ${step.office_id ?? ''}`;

        return {
          stepId: Number(step.step_id),
          stepOrder: Number(step.step_order) || 0,
          stepName: String(step.step_name || officeName),
          officeId: step.office_id != null ? Number(step.office_id) : null,
          officeName,
          completedAt: row.completed_at ?? null,
          status: 'pending' as EnrolleeRouteStepStatus,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s != null)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    let currentAssigned = false;
    steps = mapped.map((s) => {
      if (s.completedAt) {
        return { ...s, status: 'done' as const };
      }
      if (!currentAssigned) {
        currentAssigned = true;
        return { ...s, status: 'current' as const };
      }
      return { ...s, status: 'pending' as const };
    });
  }

  // Fallback: office_expectation when enrollee_progress is empty
  if (steps.length === 0) {
    const { data: expectations } = await supabase
      .from('office_expectation')
      .select(
        `
        expectation_id,
        office_id,
        expected_order,
        arrived_at,
        office:office_id(office_name)
      `,
      )
      .eq('visit_id', visit.visit_id)
      .order('expected_order', { ascending: true });

    const mapped = (expectations ?? []).map((e) => {
      const officeJoin = e.office as
        | { office_name?: string }
        | { office_name?: string }[]
        | null;
      const office = Array.isArray(officeJoin) ? officeJoin[0] : officeJoin;
      const officeName = office?.office_name?.trim() || `Office ${e.office_id}`;
      return {
        stepId: Number(e.expectation_id),
        stepOrder: Number(e.expected_order) || 0,
        stepName: officeName,
        officeId: Number(e.office_id),
        officeName,
        completedAt: e.arrived_at ?? null,
        status: 'pending' as EnrolleeRouteStepStatus,
      };
    });

    let currentAssigned = false;
    steps = mapped.map((s) => {
      if (s.completedAt) {
        return { ...s, status: 'done' as const };
      }
      if (!currentAssigned) {
        currentAssigned = true;
        return { ...s, status: 'current' as const };
      }
      return { ...s, status: 'pending' as const };
    });
  }

  const totalCount = steps.length;
  const completedCount = steps.filter((s) => s.status === 'done').length;
  const remainingCount = Math.max(0, totalCount - completedCount);
  const isFullyComplete = totalCount > 0 && remainingCount === 0;
  const percentComplete =
    totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const current = steps.find((s) => s.status === 'current');
  const currentOfficeName = isFullyComplete
    ? 'Done'
    : current?.officeName ?? null;

  return {
    qrToken: String(visit.qr_token || qrToken),
    visitId: Number(visit.visit_id),
    visitorId: Number(visit.visitor_id),
    visitorName,
    passNumber,
    controlNumber,
    progressUrl: buildEnrolleeProgressUrl(String(visit.qr_token || qrToken)),
    steps,
    completedCount,
    totalCount,
    percentComplete,
    currentOfficeName,
    remainingCount,
    isFullyComplete,
  };
}
