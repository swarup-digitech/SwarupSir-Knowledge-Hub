-- Swarup Sir's Knowledge Hub
-- Multi-attempt + 80% retry support
-- Run this once in Supabase SQL Editor.

DROP INDEX IF EXISTS public.uq_attempts_one_submission_per_student;

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'submitted';

-- Initialize attempt numbers for older rows that do not have one.
WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY assignment_id, student_id
      ORDER BY submitted_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.attempts
)
UPDATE public.attempts a
SET attempt_number = n.rn
FROM numbered n
WHERE a.id = n.id
  AND (a.attempt_number IS NULL OR a.attempt_number = 0);

-- Verification: multiple rows per student + assignment are now allowed.
SELECT
  assignment_id,
  student_id,
  COUNT(*) AS total_attempts,
  MAX(attempt_number) AS latest_attempt_number
FROM public.attempts
GROUP BY assignment_id, student_id
ORDER BY total_attempts DESC;

-- IMPORTANT:
-- Do NOT recreate the old unique index.
-- Scores below 80% remain in attempts and allow another attempt.
-- Scores of 80% or more complete the assignment.
