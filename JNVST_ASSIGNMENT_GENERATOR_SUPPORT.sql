-- JNVST Assignment Generator support
-- Safe to run after the JNVST mock_question_bank metadata migration.
-- Does not modify or delete existing questions.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_mqb_language
ON public.mock_question_bank(language);

CREATE INDEX IF NOT EXISTS idx_mqb_section_part
ON public.mock_question_bank(section_code, part_code);

CREATE INDEX IF NOT EXISTS idx_mqb_active
ON public.mock_question_bank(active);

CREATE INDEX IF NOT EXISTS idx_mqb_jnvst_assignment_filter
ON public.mock_question_bank(subject_id, lesson_id, language, active);

CREATE INDEX IF NOT EXISTS idx_mqb_variation_group
ON public.mock_question_bank(variation_group);

CREATE INDEX IF NOT EXISTS idx_mqb_fixed
ON public.mock_question_bank(is_fixed);

COMMIT;

-- Optional read-only helper for API/RPC use.
-- The current web UI performs the same filtering and random selection client-side.
CREATE OR REPLACE FUNCTION public.get_jnvst_eligible_questions(
    p_subject_id uuid,
    p_language text DEFAULT NULL,
    p_lesson_ids uuid[] DEFAULT NULL,
    p_topic text DEFAULT NULL
)
RETURNS SETOF public.mock_question_bank
LANGUAGE sql
STABLE
AS $$
    SELECT q.*
    FROM public.mock_question_bank q
    WHERE q.active = true
      AND q.subject_id = p_subject_id
      AND (p_language IS NULL OR upper(q.language) = upper(p_language))
      AND (
          p_lesson_ids IS NULL
          OR cardinality(p_lesson_ids) = 0
          OR q.lesson_id = ANY(p_lesson_ids)
      )
      AND (
          p_topic IS NULL
          OR trim(p_topic) = ''
          OR q.topic = p_topic
      )
    ORDER BY q.id;
$$;
