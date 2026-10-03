-- JNVST Mock Test Management Upgrade
-- Adds the same metadata model used by the JNVST Question Bank,
-- bilingual linkage, and explicit Lesson Code / Question Type fields.
-- Safe to run repeatedly. Existing mock_question_bank rows are preserved.

BEGIN;

ALTER TABLE public.mock_question_bank
  ADD COLUMN IF NOT EXISTS subject_id uuid,
  ADD COLUMN IF NOT EXISTS lesson_id uuid,
  ADD COLUMN IF NOT EXISTS lesson_code text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS variation_group text,
  ADD COLUMN IF NOT EXISTS is_fixed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS question_type text DEFAULT 'MCQ',
  ADD COLUMN IF NOT EXISTS marks numeric,
  ADD COLUMN IF NOT EXISTS cognitive_level text,
  ADD COLUMN IF NOT EXISTS difficulty text,
  ADD COLUMN IF NOT EXISTS explanation text,
  ADD COLUMN IF NOT EXISTS language_pair_id uuid;

-- Keep the existing JNVST hierarchy links where the tables exist.
DO $$
BEGIN
  IF to_regclass('public.jnvst_subjects') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM pg_constraint
       WHERE conname = 'fk_mock_question_bank_jnvst_subject'
     ) THEN
    ALTER TABLE public.mock_question_bank
      ADD CONSTRAINT fk_mock_question_bank_jnvst_subject
      FOREIGN KEY (subject_id)
      REFERENCES public.jnvst_subjects(id)
      ON DELETE SET NULL;
  END IF;

  IF to_regclass('public.jnvst_subject_lessons') IS NOT NULL
     AND NOT EXISTS (
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

-- Backfill Lesson Code from the linked JNVST lesson where possible.
DO $$
BEGIN
  IF to_regclass('public.jnvst_subject_lessons') IS NOT NULL THEN
    UPDATE public.mock_question_bank q
    SET lesson_code = l.lesson_code
    FROM public.jnvst_subject_lessons l
    WHERE q.lesson_id = l.id
      AND NULLIF(TRIM(q.lesson_code), '') IS NULL;
  END IF;
END $$;

-- Normalize legacy rows.
UPDATE public.mock_question_bank
SET question_type = COALESCE(NULLIF(TRIM(question_type), ''), 'MCQ')
WHERE question_type IS NULL OR TRIM(question_type) = '';

UPDATE public.mock_question_bank
SET marks = COALESCE(marks, 1)
WHERE marks IS NULL;

CREATE INDEX IF NOT EXISTS idx_mqb_jnvst_subject
  ON public.mock_question_bank(subject_id);
CREATE INDEX IF NOT EXISTS idx_mqb_jnvst_lesson
  ON public.mock_question_bank(lesson_id);
CREATE INDEX IF NOT EXISTS idx_mqb_lesson_code
  ON public.mock_question_bank(teacher_id, lesson_code);
CREATE INDEX IF NOT EXISTS idx_mqb_topic
  ON public.mock_question_bank(teacher_id, topic);
CREATE INDEX IF NOT EXISTS idx_mqb_variation_group
  ON public.mock_question_bank(variation_group);
CREATE INDEX IF NOT EXISTS idx_mqb_fixed
  ON public.mock_question_bank(is_fixed);
CREATE INDEX IF NOT EXISTS idx_mqb_question_type
  ON public.mock_question_bank(question_type);
CREATE INDEX IF NOT EXISTS idx_mqb_language_pair
  ON public.mock_question_bank(language_pair_id);
CREATE INDEX IF NOT EXISTS idx_mqb_passage_entity
  ON public.mock_question_bank(teacher_id, part_code, language, passage_id, question_order);

COMMENT ON COLUMN public.mock_question_bank.language_pair_id IS
  'Links English and Assamese versions created from the same bilingual Excel source row or passage entity.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='mock_question_bank'
  AND column_name IN (
    'subject_id','lesson_id','lesson_code','topic','variation_group',
    'is_fixed','question_type','marks','cognitive_level','difficulty',
    'language_pair_id','passage_id','passage_title','passage_text','question_order'
  )
ORDER BY ordinal_position;
