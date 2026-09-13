-- SWARUP SIR'S KNOWLEDGE HUB
-- Optional per-question hints.
-- Teachers can add/edit hints after questions have been uploaded.
-- Students see a small "Hints" button only when a hint exists.

alter table public.questions
  add column if not exists hint text null;

comment on column public.questions.hint is
  'Optional teacher-provided hint shown to students for this question.';

-- Allow teachers who own the assignment to add/change/clear hints.
-- This does not give students permission to edit questions.
drop policy if exists "Teachers can update assignment questions" on public.questions;
create policy "Teachers can update assignment questions"
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

-- Verification
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'questions'
  and column_name = 'hint';
