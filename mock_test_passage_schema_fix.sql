-- Mock Test Passage Schema Fix
-- Run this in Supabase SQL Editor BEFORE generating a new Mock Test.
-- Safe to run repeatedly.

ALTER TABLE public.mock_test_questions
  ADD COLUMN IF NOT EXISTS passage_id text,
  ADD COLUMN IF NOT EXISTS passage_title text,
  ADD COLUMN IF NOT EXISTS passage_text text;

ALTER TABLE public.mock_question_bank
  ADD COLUMN IF NOT EXISTS passage_id text,
  ADD COLUMN IF NOT EXISTS passage_title text,
  ADD COLUMN IF NOT EXISTS passage_text text;

CREATE INDEX IF NOT EXISTS idx_mock_test_questions_test_passage
  ON public.mock_test_questions(mock_test_id, passage_id, question_number);

CREATE INDEX IF NOT EXISTS idx_mock_bank_teacher_passage
  ON public.mock_question_bank(teacher_id, part_code, language, passage_id, question_order);

-- Force PostgREST/Supabase API schema cache to reload after the ALTER TABLE.
NOTIFY pgrst, 'reload schema';

-- Verification: these three rows must be returned.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('mock_test_questions', 'mock_question_bank')
  AND column_name IN ('passage_id', 'passage_title', 'passage_text')
ORDER BY table_name, column_name;
