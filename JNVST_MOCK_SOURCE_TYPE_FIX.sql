-- Fix source_type for JNVST PDF imports
-- Run this once in Supabase SQL Editor. Existing rows are preserved.

ALTER TABLE public.mock_question_bank
  DROP CONSTRAINT IF EXISTS mock_question_bank_source_type_check;

ALTER TABLE public.mock_question_bank
  ADD CONSTRAINT mock_question_bank_source_type_check
  CHECK (source_type IN ('excel','pdf','word','JNVST_BULK','JNVST_PDF'));

SELECT 'mock_question_bank source_type constraint updated' AS status;
