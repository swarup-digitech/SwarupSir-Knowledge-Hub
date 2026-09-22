-- Past Assignment Enrollment safety migration
-- Run once in Supabase SQL Editor.
-- This does NOT change existing assignments or attempts.

-- 1. Remove accidental duplicate recipient rows.
DELETE FROM public.assignment_students a
USING public.assignment_students b
WHERE a.assignment_id = b.assignment_id
  AND a.student_id = b.student_id
  AND a.ctid > b.ctid;

-- 2. Prevent the same student from being enrolled twice in an assignment.
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_students_assignment_student
ON public.assignment_students (assignment_id, student_id);

-- 3. Make sure new enrollments begin at attempt 1.
ALTER TABLE public.assignment_students
  ALTER COLUMN current_attempt_number SET DEFAULT 1;

-- Verification:
SELECT assignment_id, student_id, current_attempt_number
FROM public.assignment_students
ORDER BY assignment_id, student_id
LIMIT 20;
