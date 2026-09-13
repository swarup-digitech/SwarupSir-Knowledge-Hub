-- MOCK TEST support for Swarup Sir's Knowledge Hub
-- Run once in Supabase SQL Editor.

alter table public.assignments
  add column if not exists assignment_type text;

alter table public.assignments
  add column if not exists time_limit integer;

alter table public.assignments
  add column if not exists shuffle_questions boolean not null default false;

alter table public.assignments
  add column if not exists shuffle_options boolean not null default false;

-- Existing assignments keep their current behaviour.
update public.assignments
set assignment_type = case
  when video_url is not null and btrim(video_url) <> '' then 'VIDEO'
  else 'MCQ'
end
where assignment_type is null;

alter table public.assignments
  add constraint assignments_assignment_type_check
  check (assignment_type is null or assignment_type in ('MCQ','VIDEO','MOCK'));

alter table public.assignments
  add constraint assignments_time_limit_check
  check (time_limit is null or time_limit > 0);

create index if not exists idx_assignments_assignment_type
  on public.assignments(assignment_type);
