-- JNVST Group & Subject Management
-- Run once in Supabase SQL Editor.
-- Extends existing classes-based JNVST grouping without breaking existing assignments.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS jnvst_group_type text,
  ADD COLUMN IF NOT EXISTS jnvst_parent_id uuid REFERENCES public.classes(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_classes_jnvst_parent ON public.classes(jnvst_parent_id);
CREATE INDEX IF NOT EXISTS idx_classes_jnvst_group_type ON public.classes(teacher_id, jnvst_group_type);

-- Subject catalogue for each teacher.
CREATE TABLE IF NOT EXISTS public.jnvst_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jnvst_subject_teacher_name
ON public.jnvst_subjects(teacher_id, lower(trim(name)));

ALTER TABLE public.jnvst_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers manage own JNVST subjects" ON public.jnvst_subjects;
CREATE POLICY "Teachers manage own JNVST subjects"
ON public.jnvst_subjects FOR ALL TO authenticated
USING (teacher_id = auth.uid())
WITH CHECK (teacher_id = auth.uid());

-- Mark fixed groups and existing fixed sub-groups.
UPDATE public.classes
SET jnvst_group_type='MAIN', jnvst_parent_id=NULL
WHERE teacher_id IS NOT NULL
  AND (
    upper(trim(name)) IN ('JNVST-VI','JNVST-VI (CLASS-IV)','JNVST-VI (CLASS VI)','JNVST-6')
    OR upper(trim(name)) IN ('JNVST-IX','JNVST-IX (CLASS IX)','JNVST-9')
  )
  AND (course IN ('JNVST-6','JNVST-9') OR upper(trim(name)) LIKE 'JNVST-%');

UPDATE public.classes c
SET jnvst_group_type='SUB',
    jnvst_parent_id=p.id
FROM public.classes p
WHERE c.teacher_id=p.teacher_id
  AND c.jnvst_group_type IS DISTINCT FROM 'MAIN'
  AND c.description ~* '^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)'
  AND p.jnvst_group_type='MAIN'
  AND (
    (regexp_replace(c.description, '^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?.*$', '\1', 'i') ILIKE 'JNVST-VI' AND upper(trim(p.name)) LIKE 'JNVST-VI%')
    OR
    (regexp_replace(c.description, '^JNVST_SUBGROUP_PARENT:(JNVST-VI|JNVST-IX)\s*\|?.*$', '\1', 'i') ILIKE 'JNVST-IX' AND upper(trim(p.name)) LIKE 'JNVST-IX%')
  );

-- Seed the four requested subjects for every existing teacher who has JNVST data.
INSERT INTO public.jnvst_subjects (teacher_id,name)
SELECT DISTINCT p.id, v.name
FROM public.profiles p
CROSS JOIN (VALUES
 ('Mental Ability'),('EVS'),('Arithmetic'),('Language')
) v(name)
WHERE p.role='teacher'
  AND NOT EXISTS (
    SELECT 1 FROM public.jnvst_subjects s
    WHERE s.teacher_id=p.id AND lower(trim(s.name))=lower(trim(v.name))
  );
