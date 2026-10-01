-- School Course discriminator used by the School Question Bank UI.
-- This does not create or modify JNVST questions in mock_question_bank.

ALTER TABLE public.school_question_bank_questions
  ADD COLUMN IF NOT EXISTS course_type text NOT NULL DEFAULT 'SCHOOL';

ALTER TABLE public.school_question_bank_questions
  DROP CONSTRAINT IF EXISTS school_question_bank_questions_course_type_check;

ALTER TABLE public.school_question_bank_questions
  ADD CONSTRAINT school_question_bank_questions_course_type_check
  CHECK (course_type IN ('JNVST','SCHOOL'));

CREATE INDEX IF NOT EXISTS idx_qb_questions_teacher_course
  ON public.school_question_bank_questions(teacher_id, course_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qb_questions_school_filter
  ON public.school_question_bank_questions(teacher_id, course_type, chapter_id, topic);

SELECT 'School Course discriminator migration complete' AS status;
