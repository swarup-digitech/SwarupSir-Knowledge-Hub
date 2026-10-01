-- JNVST Subject -> Lesson -> Sub-lesson categorization
-- Preserves all existing Question Bank categories: Chapter/Subchapter, Topic,
-- Subject, Medium, Cognitive Level, Difficulty and Variation Group.
-- Run once in Supabase SQL Editor after JNVST_GROUP_SUBJECT_MANAGEMENT.sql.

CREATE TABLE IF NOT EXISTS public.jnvst_subject_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid NOT NULL REFERENCES public.jnvst_subjects(id) ON DELETE CASCADE,
  parent_lesson_id uuid REFERENCES public.jnvst_subject_lessons(id) ON DELETE RESTRICT,
  lesson_code text NOT NULL,
  lesson_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jnvst_subject_lesson_code
ON public.jnvst_subject_lessons(teacher_id, subject_id, lower(trim(lesson_code)));

CREATE INDEX IF NOT EXISTS idx_jnvst_subject_lessons_subject
ON public.jnvst_subject_lessons(teacher_id, subject_id, parent_lesson_id, lesson_code);

ALTER TABLE public.jnvst_subject_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own JNVST subject lessons" ON public.jnvst_subject_lessons;
CREATE POLICY "Teachers manage own JNVST subject lessons"
ON public.jnvst_subject_lessons FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

ALTER TABLE public.school_question_bank_questions
  ADD COLUMN IF NOT EXISTS jnvst_subject_id uuid REFERENCES public.jnvst_subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS jnvst_lesson_id uuid REFERENCES public.jnvst_subject_lessons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_school_qb_jnvst_subject
ON public.school_question_bank_questions(teacher_id, jnvst_subject_id);

CREATE INDEX IF NOT EXISTS idx_school_qb_jnvst_lesson
ON public.school_question_bank_questions(teacher_id, jnvst_lesson_id);

-- Optional compatibility backfill:
-- Existing questions are NOT automatically reassigned because their correct
-- JNVST Subject/Lesson cannot be safely inferred. Teachers can edit them in
-- Question Bank and assign the new JNVST category while keeping all old fields.

SELECT 'JNVST Subject -> Lesson -> Sub-lesson categorization migration complete' AS status;
