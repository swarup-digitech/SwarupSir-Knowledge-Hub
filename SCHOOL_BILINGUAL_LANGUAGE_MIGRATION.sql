-- SCHOOL COURSE ONLY: Bilingual English + Assamese question support
-- Safe to run repeatedly in Supabase SQL Editor.
-- IMPORTANT: This migration does NOT modify JNVST question data.
-- The same School question row stores both language versions, so English + Assamese
-- are one question and keep one serial number in "Both Medium" papers.

BEGIN;

-- The existing School question-bank design uses question_text_en/question_text_as
-- in the SAME row. Add the language-status column only if an older database does
-- not have it yet.
ALTER TABLE public.school_question_bank_questions
  ADD COLUMN IF NOT EXISTS medium text;

-- These columns are required by the current School bilingual importer/editor.
-- IF NOT EXISTS makes this safe for databases where some upgrades were already run.
ALTER TABLE public.school_question_bank_questions
  ADD COLUMN IF NOT EXISTS question_text_en text,
  ADD COLUMN IF NOT EXISTS question_text_as text,
  ADD COLUMN IF NOT EXISTS correct_answer text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS text_book boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS textbook_reference text,
  ADD COLUMN IF NOT EXISTS source_fingerprint text,
  ADD COLUMN IF NOT EXISTS variation_group text,
  ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false;

-- Normalize language status for SCHOOL rows only.
UPDATE public.school_question_bank_questions
SET medium = CASE
  WHEN NULLIF(trim(coalesce(question_text_en,'')), '') IS NOT NULL
   AND NULLIF(trim(coalesce(question_text_as,'')), '') IS NOT NULL THEN 'BOTH'
  WHEN NULLIF(trim(coalesce(question_text_en,'')), '') IS NOT NULL THEN 'ENGLISH'
  WHEN NULLIF(trim(coalesce(question_text_as,'')), '') IS NOT NULL THEN 'ASSAMESE'
  ELSE NULL
END
WHERE course_type = 'SCHOOL';

-- Keep the metadata constrained to the three valid School language states.
ALTER TABLE public.school_question_bank_questions
  DROP CONSTRAINT IF EXISTS school_question_bank_questions_medium_check;

ALTER TABLE public.school_question_bank_questions
  ADD CONSTRAINT school_question_bank_questions_medium_check
  CHECK (medium IS NULL OR medium IN ('ENGLISH','ASSAMESE','BOTH'));

CREATE INDEX IF NOT EXISTS idx_school_qb_language
  ON public.school_question_bank_questions(teacher_id, course_type, medium);

CREATE INDEX IF NOT EXISTS idx_school_qb_source_fingerprint
  ON public.school_question_bank_questions(source_fingerprint)
  WHERE source_fingerprint IS NOT NULL;

-- Refresh Supabase/PostgREST schema cache.
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Verification: this should return the medium column and the three School statuses.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='school_question_bank_questions'
  AND column_name IN ('medium','question_text_en','question_text_as','correct_answer','topic','text_book','textbook_reference','source_fingerprint','variation_group','is_fixed')
ORDER BY column_name;

SELECT medium, count(*) AS question_count
FROM public.school_question_bank_questions
WHERE course_type='SCHOOL'
GROUP BY medium
ORDER BY medium;
