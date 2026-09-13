-- Per-question solution video support
-- Run once in Supabase SQL Editor.

alter table public.questions
  add column if not exists solution_video_url text null;

comment on column public.questions.solution_video_url is
  'Optional YouTube solution/explanation video shown to the student after submission with the answer key';

-- Replace the previous hint-edit policy so teachers can edit both hints
-- and solution video links for questions belonging to their own assignments.
drop policy if exists "Teachers can update hints on their questions"
on public.questions;

create policy "Teachers can update hints and solution videos on their questions"
on public.questions
for update
to authenticated
using (
  exists (
    select 1
    from public.assignments a
    where a.id = questions.assignment_id
      and a.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    where a.id = questions.assignment_id
      and a.created_by = auth.uid()
  )
);
