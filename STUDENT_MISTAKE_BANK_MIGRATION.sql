-- Student Mistake Bank / Question Performance
-- Run once in Supabase SQL Editor AFTER the Mock Question Bank exists.

CREATE TABLE IF NOT EXISTS public.student_question_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mock_question_id uuid NOT NULL REFERENCES public.mock_question_bank(id) ON DELETE CASCADE,
  attempt_count integer NOT NULL DEFAULT 0,
  wrong_count integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  last_result boolean,
  first_wrong_at timestamptz,
  last_wrong_at timestamptz,
  last_correct_at timestamptz,
  last_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, mock_question_id)
);

CREATE INDEX IF NOT EXISTS idx_student_question_performance_student
  ON public.student_question_performance(student_id);
CREATE INDEX IF NOT EXISTS idx_student_question_performance_question
  ON public.student_question_performance(mock_question_id);
CREATE INDEX IF NOT EXISTS idx_student_question_performance_wrong
  ON public.student_question_performance(student_id, wrong_count DESC);

ALTER TABLE public.student_question_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students read own question performance"
  ON public.student_question_performance;
CREATE POLICY "students read own question performance"
ON public.student_question_performance
FOR SELECT TO authenticated
USING (student_id = auth.uid());

DROP POLICY IF EXISTS "teachers read their students question performance"
  ON public.student_question_performance;
CREATE POLICY "teachers read their students question performance"
ON public.student_question_performance
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.mock_question_bank q
    JOIN public.profiles p ON p.id = auth.uid()
    WHERE q.id = student_question_performance.mock_question_id
      AND p.role = 'teacher'
      AND q.teacher_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.record_student_question_results(
  p_student_id uuid,
  p_results jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_student_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN
    SELECT *
    FROM jsonb_to_recordset(COALESCE(p_results, '[]'::jsonb))
      AS x(mock_question_id uuid, is_correct boolean)
    WHERE mock_question_id IS NOT NULL
  LOOP
    INSERT INTO public.student_question_performance
      (student_id, mock_question_id, attempt_count, wrong_count, correct_count,
       last_result, first_wrong_at, last_wrong_at, last_correct_at,
       last_attempted_at, updated_at)
    VALUES
      (p_student_id, r.mock_question_id, 1,
       CASE WHEN r.is_correct THEN 0 ELSE 1 END,
       CASE WHEN r.is_correct THEN 1 ELSE 0 END,
       r.is_correct,
       CASE WHEN r.is_correct THEN NULL ELSE now() END,
       CASE WHEN r.is_correct THEN NULL ELSE now() END,
       CASE WHEN r.is_correct THEN now() ELSE NULL END,
       now(), now())
    ON CONFLICT (student_id, mock_question_id)
    DO UPDATE SET
      attempt_count = student_question_performance.attempt_count + 1,
      wrong_count = student_question_performance.wrong_count +
        CASE WHEN r.is_correct THEN 0 ELSE 1 END,
      correct_count = student_question_performance.correct_count +
        CASE WHEN r.is_correct THEN 1 ELSE 0 END,
      last_result = r.is_correct,
      first_wrong_at = CASE
        WHEN r.is_correct THEN student_question_performance.first_wrong_at
        ELSE COALESCE(student_question_performance.first_wrong_at, now())
      END,
      last_wrong_at = CASE
        WHEN r.is_correct THEN student_question_performance.last_wrong_at
        ELSE now()
      END,
      last_correct_at = CASE
        WHEN r.is_correct THEN now()
        ELSE student_question_performance.last_correct_at
      END,
      last_attempted_at = now(),
      updated_at = now();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.record_student_question_results(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_student_question_results(uuid, jsonb) TO authenticated;

SELECT 'Student Mistake Bank migration complete' AS status;
