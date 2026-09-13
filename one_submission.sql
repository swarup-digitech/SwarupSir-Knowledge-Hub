-- ONE SUBMISSION PER STUDENT PER ASSIGNMENT
-- Run once in Supabase SQL Editor.
--
-- OPTIONAL: inspect duplicates first:
-- SELECT assignment_id, student_id, COUNT(*) AS submissions
-- FROM public.attempts
-- GROUP BY assignment_id, student_id
-- HAVING COUNT(*) > 1;

-- Keep the latest submission for each student + assignment.
-- Delete answer rows belonging to older duplicate attempts.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY assignment_id, student_id
           ORDER BY submitted_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.attempts
),
duplicates AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM public.answers
WHERE attempt_id IN (SELECT id FROM duplicates);

-- Delete the older duplicate attempts.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY assignment_id, student_id
           ORDER BY submitted_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.attempts
)
DELETE FROM public.attempts
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Prevent duplicates permanently.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempts_one_submission_per_student
ON public.attempts (assignment_id, student_id);

-- Verification: this should return ZERO rows.
SELECT assignment_id, student_id, COUNT(*) AS submissions
FROM public.attempts
GROUP BY assignment_id, student_id
HAVING COUNT(*) > 1;
