-- Fix duplicated office_expectation rows (1,1,2,2,3,3…).
-- Keep the newest expectation_id per (visit_id, expected_order).
-- Run in Supabase SQL Editor.

-- 1) Preview duplicates
-- SELECT visit_id, expected_order, COUNT(*) AS cnt
-- FROM office_expectation
-- GROUP BY visit_id, expected_order
-- HAVING COUNT(*) > 1
-- ORDER BY visit_id, expected_order;

-- 2) Delete older duplicates (keep max expectation_id per visit + order)
DELETE FROM office_expectation oe
WHERE oe.expectation_id IN (
  SELECT expectation_id
  FROM (
    SELECT
      expectation_id,
      ROW_NUMBER() OVER (
        PARTITION BY visit_id, expected_order
        ORDER BY expectation_id DESC
      ) AS rn
    FROM office_expectation
  ) ranked
  WHERE ranked.rn > 1
);

-- 3) Ensure anon/authenticated can DELETE (needed for app sync cleanup)
DO $$
BEGIN
  IF to_regclass('public.office_expectation') IS NULL THEN
    RAISE NOTICE 'office_expectation missing';
    RETURN;
  END IF;

  ALTER TABLE public.office_expectation ENABLE ROW LEVEL SECURITY;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'office_expectation'
      AND policyname = 'anon_office_expectation_all'
  ) THEN
    CREATE POLICY anon_office_expectation_all
      ON public.office_expectation
      FOR ALL
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
