-- Swarup Sir's Knowledge Hub
-- ONE SUBMISSION UNTIL TEACHER RE-ASSIGNS
--
-- Purpose:
--   1. A student may submit the same assignment only once for the current
--      assignment attempt.
--   2. A double-click / simultaneous request cannot create two submissions.
--   3. A teacher can re-assign an already submitted student. That increments
--      current_attempt_number and allows exactly one new submission.
--   4. Previous attempts are retained for teacher history.
--   5. The automatic "below 80% after 3 hours" retry is preserved.
--     Teacher re-assignment is an additional way to open a new attempt.

begin;

-- ---------------------------------------------------------------------------
-- 1. Track which attempt number is currently open for each assignment/student.
-- ---------------------------------------------------------------------------
alter table public.assignment_students
  add column if not exists current_attempt_number integer not null default 1;

update public.assignment_students
set current_attempt_number = 1
where current_attempt_number is null or current_attempt_number < 1;

-- ---------------------------------------------------------------------------
-- 2. Remove the old single-column uniqueness rule if it exists.
--    We now make the attempt number part of the uniqueness rule.
-- ---------------------------------------------------------------------------
drop index if exists public.uq_attempts_one_submission_per_student;

-- ---------------------------------------------------------------------------
-- 3. Clean accidental double-click duplicates.
--
--    Rows for the same student + assignment submitted within 5 seconds are
--    treated as accidental duplicate submissions. The first row is retained.
--    This is intentionally narrow so legitimate teacher-authorized retries
--    from different times are preserved.
--
--    Back up the rows and their answers before deletion.
-- ---------------------------------------------------------------------------
create table if not exists public.attempts_duplicate_cleanup_backup
  as select * from public.attempts with no data;

create table if not exists public.answers_duplicate_cleanup_backup
  as select * from public.answers with no data;

with ordered as (
  select
    id,
    assignment_id,
    student_id,
    submitted_at,
    lag(submitted_at) over (
      partition by assignment_id, student_id
      order by submitted_at asc nulls last, id asc
    ) as previous_submitted_at
  from public.attempts
),
duplicate_ids as (
  select id
  from ordered
  where previous_submitted_at is not null
    and submitted_at is not null
    and submitted_at <= previous_submitted_at + interval '5 seconds'
)
insert into public.attempts_duplicate_cleanup_backup
select a.*
from public.attempts a
where a.id in (select id from duplicate_ids)
  and not exists (
    select 1 from public.attempts_duplicate_cleanup_backup b
    where b.id = a.id
  );

with ordered as (
  select
    id,
    assignment_id,
    student_id,
    submitted_at,
    lag(submitted_at) over (
      partition by assignment_id, student_id
      order by submitted_at asc nulls last, id asc
    ) as previous_submitted_at
  from public.attempts
),
duplicate_ids as (
  select id
  from ordered
  where previous_submitted_at is not null
    and submitted_at is not null
    and submitted_at <= previous_submitted_at + interval '5 seconds'
)
insert into public.answers_duplicate_cleanup_backup
select an.*
from public.answers an
where an.attempt_id in (select id from duplicate_ids)
  and not exists (
    select 1 from public.answers_duplicate_cleanup_backup b
    where b.attempt_id = an.attempt_id
      and b.id = an.id
  );

with ordered as (
  select
    id,
    submitted_at,
    lag(submitted_at) over (
      partition by assignment_id, student_id
      order by submitted_at asc nulls last, id asc
    ) as previous_submitted_at
  from public.attempts
),
duplicate_ids as (
  select id
  from ordered
  where previous_submitted_at is not null
    and submitted_at is not null
    and submitted_at <= previous_submitted_at + interval '5 seconds'
)
delete from public.answers
where attempt_id in (select id from duplicate_ids);

with ordered as (
  select
    id,
    submitted_at,
    lag(submitted_at) over (
      partition by assignment_id, student_id
      order by submitted_at asc nulls last, id asc
    ) as previous_submitted_at
  from public.attempts
),
duplicate_ids as (
  select id
  from ordered
  where previous_submitted_at is not null
    and submitted_at is not null
    and submitted_at <= previous_submitted_at + interval '5 seconds'
)
delete from public.attempts
where id in (select id from duplicate_ids);

-- ---------------------------------------------------------------------------
-- 4. Normalize attempt numbers for existing historical submissions.
-- ---------------------------------------------------------------------------
with numbered as (
  select
    id,
    row_number() over (
      partition by assignment_id, student_id
      order by submitted_at asc nulls last, id asc
    ) as rn
  from public.attempts
)
update public.attempts a
set attempt_number = n.rn
from numbered n
where a.id = n.id;

alter table public.attempts
  alter column attempt_number set default 1;

alter table public.attempts
  alter column attempt_number set not null;

-- One row per student + assignment + attempt number.
create unique index if not exists uq_attempts_assignment_student_attempt
on public.attempts (assignment_id, student_id, attempt_number);

-- ---------------------------------------------------------------------------
-- 5. Synchronize the currently open attempt number with existing history.
-- ---------------------------------------------------------------------------
update public.assignment_students s
set current_attempt_number = greatest(
  1,
  coalesce((
    select max(a.attempt_number)
    from public.attempts a
    where a.assignment_id = s.assignment_id
      and a.student_id = s.student_id
  ), 1)
);

-- ---------------------------------------------------------------------------
-- 6. Teacher re-assignment RPC.
--
--    New student:
--       insert assignment_students with attempt 1.
--
--    Existing student with a submitted current attempt:
--       increment current_attempt_number by 1.
--
--    Existing student without a submitted current attempt:
--       leave unchanged; re-assignment must not create a duplicate attempt.
-- ---------------------------------------------------------------------------
create or replace function public.reassign_assignment_students(
  p_assignment_id uuid,
  p_student_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sid uuid;
  current_no integer;
  reassigned_count integer := 0;
  new_count integer := 0;
  pending_count integer := 0;
begin
  if not exists (
    select 1
    from public.assignments a
    where a.id = p_assignment_id
      and a.created_by = auth.uid()
  ) then
    raise exception 'You are not allowed to re-assign this assignment.';
  end if;

  foreach sid in array coalesce(p_student_ids, '{}'::uuid[]) loop
    select s.current_attempt_number
      into current_no
    from public.assignment_students s
    where s.assignment_id = p_assignment_id
      and s.student_id = sid
    for update;

    if not found then
      insert into public.assignment_students
        (assignment_id, student_id, current_attempt_number)
      values
        (p_assignment_id, sid, 1)
      on conflict (assignment_id, student_id) do nothing;

      new_count := new_count + 1;
    else
      current_no := greatest(1, coalesce(current_no, 1));

      if exists (
        select 1
        from public.attempts at
        where at.assignment_id = p_assignment_id
          and at.student_id = sid
          and at.attempt_number = current_no
          and at.submitted_at is not null
      ) then
        update public.assignment_students
        set current_attempt_number = current_no + 1
        where assignment_id = p_assignment_id
          and student_id = sid;

        reassigned_count := reassigned_count + 1;
      else
        pending_count := pending_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'new_students', new_count,
    'reassigned_students', reassigned_count,
    'pending_students', pending_count
  );
end;
$$;

revoke all on function public.reassign_assignment_students(uuid, uuid[]) from public;
grant execute on function public.reassign_assignment_students(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Preserve the automatic below-80% / 3-hour retry.
--    A low-scoring submission is deleted after 3 hours, which makes the
--    current attempt available again. Teacher re-assignment can also advance
--    the current_attempt_number and therefore open a new attempt immediately.
-- ---------------------------------------------------------------------------
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
  select coalesce(array_agg(id), '{}'::uuid[])
    into failed_ids
  from public.attempts
  where submitted_at is not null
    and submitted_at <= now() - interval '3 hours'
    and total_questions > 0
    and (score * 100) < (total_questions * 80);

  if cardinality(failed_ids) = 0 then
    return 0;
  end if;

  delete from public.answers
  where attempt_id = any(failed_ids);

  delete from public.attempts
  where id = any(failed_ids);

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

select cron.schedule(
  'reset-low-score-submissions',
  '*/5 * * * *',
  'select private.reset_low_score_submissions();'
);

commit;

-- Verification:
select
  assignment_id,
  student_id,
  attempt_number,
  score,
  total_questions,
  submitted_at
from public.attempts
order by assignment_id, student_id, attempt_number;

select
  assignment_id,
  student_id,
  current_attempt_number
from public.assignment_students
order by assignment_id, student_id;
