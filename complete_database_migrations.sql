-- SWARUP SIR'S KNOWLEDGE HUB
-- Complete optional/feature migrations for the restored package.
-- Run once in Supabase SQL Editor.
-- Safe to re-run where IF NOT EXISTS / guarded policies are used.

-- 1. Student Roll No login support
alter table public.profiles add column if not exists roll_no text;
create unique index if not exists profiles_student_roll_no_unique
on public.profiles (roll_no)
where role = 'student' and roll_no is not null;

-- 2. Teacher-viewable classroom credentials
create table if not exists public.student_credentials (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  password_plaintext text not null,
  updated_at timestamptz not null default now()
);
alter table public.student_credentials enable row level security;

-- 3. Per-question hints
alter table public.questions add column if not exists hint text null;
comment on column public.questions.hint is
  'Optional teacher-provided hint shown to students for this question.';

-- 4. Per-question solution videos
alter table public.questions add column if not exists solution_video_url text null;
comment on column public.questions.solution_video_url is
  'Optional YouTube solution/explanation video shown after submission.';

-- 5. Per-question explanations
alter table public.questions add column if not exists explanation text null;
comment on column public.questions.explanation is
  'Optional explanation shown after submission near the answer key and solution video.';

-- 6. Teacher question-update policy for hints, videos and explanations
-- Replace older versions of this policy if they exist.
drop policy if exists "Teachers can update assignment questions" on public.questions;
drop policy if exists "Teachers can update hints on their questions" on public.questions;
drop policy if exists "Teachers can update hints and solution videos on their questions" on public.questions;
create policy "Teachers can update assignment questions"
on public.questions
for update to authenticated
using (
  exists (
    select 1 from public.assignments a
    where a.id = questions.assignment_id and a.created_by = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.assignments a
    where a.id = questions.assignment_id and a.created_by = auth.uid()
  )
);

-- 7. Teacher delete permissions used by the dashboard
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assignments' and policyname='Teachers can delete their assignments') then
    create policy "Teachers can delete their assignments" on public.assignments
      for delete to public using (created_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assignment_students' and policyname='Teachers can delete assignment recipients') then
    create policy "Teachers can delete assignment recipients" on public.assignment_students
      for delete to public using (exists (select 1 from public.assignments a where a.id = assignment_students.assignment_id and a.created_by = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='questions' and policyname='Teachers can delete assignment questions') then
    create policy "Teachers can delete assignment questions" on public.questions
      for delete to public using (exists (select 1 from public.assignments a where a.id = questions.assignment_id and a.created_by = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attempts' and policyname='Teachers can delete attempts') then
    create policy "Teachers can delete attempts" on public.attempts
      for delete to public using (exists (select 1 from public.assignments a where a.id = attempts.assignment_id and a.created_by = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='answers' and policyname='Teachers can delete answers') then
    create policy "Teachers can delete answers" on public.answers
      for delete to public using (exists (select 1 from public.attempts at join public.assignments a on a.id = at.assignment_id where at.id = answers.attempt_id and a.created_by = auth.uid()));
  end if;
end $$;

-- 8. One submission per student per assignment.
-- Remove older duplicate attempts first, keeping the latest.
with ranked as (
  select id, row_number() over (partition by assignment_id, student_id order by submitted_at desc nulls last, id desc) rn
  from public.attempts
), duplicates as (select id from ranked where rn > 1)
delete from public.answers where attempt_id in (select id from duplicates);
with ranked as (
  select id, row_number() over (partition by assignment_id, student_id order by submitted_at desc nulls last, id desc) rn
  from public.attempts
)
delete from public.attempts where id in (select id from ranked where rn > 1);
create unique index if not exists uq_attempts_one_submission_per_student
on public.attempts (assignment_id, student_id);

-- 9. Automatic low-score re-attempt: below 80% after 3 hours.
create schema if not exists private;
create or replace function private.reset_low_score_submissions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  failed_ids uuid[];
  deleted_count integer := 0;
begin
  select coalesce(array_agg(id), '{}'::uuid[]) into failed_ids
  from public.attempts
  where submitted_at is not null
    and submitted_at <= now() - interval '3 hours'
    and total_questions > 0
    and (score * 100) < (total_questions * 80);
  if cardinality(failed_ids) = 0 then return 0; end if;
  delete from public.answers where attempt_id = any(failed_ids);
  delete from public.attempts where id = any(failed_ids);
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;
revoke execute on function private.reset_low_score_submissions() from public, anon, authenticated;
create extension if not exists pg_cron;
do $$
begin
  if exists (select 1 from cron.job where jobname = 'reset-low-score-submissions') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-low-score-submissions';
  end if;
end $$;
select cron.schedule('reset-low-score-submissions','*/5 * * * *','select private.reset_low_score_submissions();');

-- Existing students: set Roll No values as needed, for example:
-- update public.profiles set roll_no = '1' where id = 'STUDENT-UUID-HERE';
