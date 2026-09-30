-- Assignment Question Bank integration
-- Run once in Supabase SQL Editor.
-- This links an assignment question snapshot back to the original Mock Test Question Bank row.

DO $$
BEGIN
  IF to_regclass('public.questions') IS NOT NULL THEN
    ALTER TABLE public.questions
      ADD COLUMN IF NOT EXISTS source_mock_question_id uuid;
    BEGIN
      ALTER TABLE public.questions
        ADD CONSTRAINT questions_source_mock_question_id_fkey
        FOREIGN KEY (source_mock_question_id)
        REFERENCES public.mock_question_bank(id)
        ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
    CREATE INDEX IF NOT EXISTS idx_questions_source_mock_question_id
      ON public.questions(source_mock_question_id);
  END IF;
END $$;

SELECT 'Assignment Question Bank migration complete' AS status;
