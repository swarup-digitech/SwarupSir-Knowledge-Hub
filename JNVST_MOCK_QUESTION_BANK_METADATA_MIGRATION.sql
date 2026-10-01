-- JNVST Mock Question Bank metadata
-- Safe to run once. Existing mock_question_bank rows are preserved.

ALTER TABLE public.mock_question_bank
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS lesson_id uuid,
  ADD COLUMN IF NOT EXISTS variation_group text,
  ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_mock_question_bank_jnvst_subject'
  ) THEN
    ALTER TABLE public.mock_question_bank
      ADD CONSTRAINT fk_mock_question_bank_jnvst_subject
      FOREIGN KEY (subject_id)
      REFERENCES public.jnvst_subjects(id)
      ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_mock_question_bank_jnvst_lesson'
  ) THEN
    ALTER TABLE public.mock_question_bank
      ADD CONSTRAINT fk_mock_question_bank_jnvst_lesson
      FOREIGN KEY (lesson_id)
      REFERENCES public.jnvst_subject_lessons(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mqb_jnvst_subject
  ON public.mock_question_bank(subject_id);
CREATE INDEX IF NOT EXISTS idx_mqb_jnvst_lesson
  ON public.mock_question_bank(lesson_id);
CREATE INDEX IF NOT EXISTS idx_mqb_variation_group
  ON public.mock_question_bank(variation_group);
CREATE INDEX IF NOT EXISTS idx_mqb_fixed
  ON public.mock_question_bank(is_fixed);
CREATE INDEX IF NOT EXISTS idx_mqb_jnvst_assignment_filter
  ON public.mock_question_bank(subject_id, lesson_id, language, active);

SELECT 'JNVST mock_question_bank metadata migration complete' AS status;
