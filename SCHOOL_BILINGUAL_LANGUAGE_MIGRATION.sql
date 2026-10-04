-- School Question Bank bilingual language support.
-- Run once in Supabase SQL Editor.
-- JNVST tables are not changed.

-- The existing school question row stores the linked English + Assamese versions.
-- This migration only normalizes the language metadata in the existing SCHOOL rows.
UPDATE public.school_question_bank_questions
SET medium = CASE
  WHEN NULLIF(trim(coalesce(question_text_en,'')), '') IS NOT NULL
   AND NULLIF(trim(coalesce(question_text_as,'')), '') IS NOT NULL THEN 'BOTH'
  WHEN NULLIF(trim(coalesce(question_text_en,'')), '') IS NOT NULL THEN 'ENGLISH'
  WHEN NULLIF(trim(coalesce(question_text_as,'')), '') IS NOT NULL THEN 'ASSAMESE'
  ELSE NULL
END
WHERE course_type = 'SCHOOL';

CREATE INDEX IF NOT EXISTS idx_school_qb_language
ON public.school_question_bank_questions(teacher_id, course_type, medium);

-- Optional verification:
-- SELECT medium, count(*) FROM public.school_question_bank_questions
-- WHERE course_type='SCHOOL' GROUP BY medium ORDER BY medium;
