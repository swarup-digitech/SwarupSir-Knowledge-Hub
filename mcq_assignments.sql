-- Swarup Sir's Knowledge Hub
-- MCQ-Only Assignments + Unified Assignment Groups
-- Run once in Supabase SQL Editor after the existing assignment tables are present.

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS assignment_type text DEFAULT 'video_mcq';

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS group_name text;

UPDATE public.assignments
SET assignment_type = 'video_mcq'
WHERE assignment_type IS NULL OR trim(assignment_type) = '';

CREATE INDEX IF NOT EXISTS idx_assignments_created_by_group
  ON public.assignments(created_by, group_name);

CREATE INDEX IF NOT EXISTS idx_assignments_type
  ON public.assignments(assignment_type);

-- Public bucket is used only for assignment question images so students can
-- display PDF-uploaded questions. Do not store private student information here.
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-question-images', 'assignment-question-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Teacher helper for Storage policies.
CREATE OR REPLACE FUNCTION public.is_assignment_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

DROP POLICY IF EXISTS "assignment question images teacher upload"
  ON storage.objects;
DROP POLICY IF EXISTS "assignment question images teacher delete"
  ON storage.objects;

CREATE POLICY "assignment question images teacher upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'assignment-question-images'
  AND public.is_assignment_teacher()
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "assignment question images teacher delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'assignment-question-images'
  AND public.is_assignment_teacher()
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Verify
SELECT id, title, assignment_type, group_name
FROM public.assignments
ORDER BY created_at DESC;
