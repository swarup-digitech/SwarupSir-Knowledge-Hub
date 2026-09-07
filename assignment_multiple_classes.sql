-- =========================================================
-- Swarup Sir's Knowledge Hub
-- Assignment improvements
-- 1) Allow MCQ-only assignments without a video URL
-- 2) No separate recipient table change is required:
--    the existing assignment_students table stores all students
--    from multiple selected classes.
-- =========================================================

ALTER TABLE public.assignments
  ALTER COLUMN video_url DROP NOT NULL;

ALTER TABLE public.assignments
  ALTER COLUMN assignment_type SET DEFAULT 'video_mcq';

-- Existing video assignments are unchanged.
-- MCQ-only assignments may now use video_url = NULL.
