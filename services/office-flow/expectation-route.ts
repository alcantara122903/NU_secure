import { supabase } from '@/services/database/supabase';

export type OfficeExpectationRow = {
  expectation_id: number;
  office_id: number;
  expected_order: number;
  arrived_at: string | null;
  expectation_status_id: number | null;
};

export async function loadExpectationsForVisit(visitId: number): Promise<OfficeExpectationRow[]> {
  const { data } = await supabase
    .from('office_expectation')
    .select('expectation_id, office_id, expected_order, arrived_at, expectation_status_id')
    .eq('visit_id', visitId)
    .order('expected_order', { ascending: true });

  return (data ?? []) as OfficeExpectationRow[];
}

export function expectationsAreFullyCheckedIn(expectations: OfficeExpectationRow[]): boolean {
  return expectations.length > 0 && expectations.every((e) => !!e.arrived_at);
}

export function firstPendingExpectation(
  expectations: OfficeExpectationRow[],
): OfficeExpectationRow | undefined {
  return expectations.find((e) => !e.arrived_at);
}
