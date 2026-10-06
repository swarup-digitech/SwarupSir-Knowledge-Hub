-- JNVST Question Bank: Variation Group support
-- JNVST ONLY. This migration does not alter any school_question_bank_* table.
-- Safe to run repeatedly.

BEGIN;

ALTER TABLE public.mock_question_bank
  ADD COLUMN IF NOT EXISTS variation_group text;

CREATE INDEX IF NOT EXISTS idx_mock_question_bank_teacher_variation_group
  ON public.mock_question_bank(teacher_id, variation_group);

CREATE INDEX IF NOT EXISTS idx_mock_question_bank_part_variation_group
  ON public.mock_question_bank(teacher_id, part_code, variation_group)
  WHERE active = true;

COMMENT ON COLUMN public.mock_question_bank.variation_group IS
  'JNVST question variation group. Questions with the same non-empty group code are similar alternatives; the JNVST paper generator can select at most one from each group.';

COMMIT;

NOTIFY pgrst, 'reload schema';

-- Verification
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='mock_question_bank'
  AND column_name='variation_group';
