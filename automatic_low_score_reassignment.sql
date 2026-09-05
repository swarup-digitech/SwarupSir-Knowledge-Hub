-- SWARUP SIR'S KNOWLEDGE HUB
-- Automatic re-attempt rule:
-- If a student scores BELOW 80% on an assignment,
-- delete that submission (answers + attempt) after 3 hours.
-- The assignment_students row is intentionally KEPT, so the assignment
-- automatically becomes available to the student again.
-- A score of exactly 80% is NOT deleted.

-- 1. Create a private schema for the privileged maintenance function.
create schema if not exists private;

-- 2. Function that removes only failed submissions older than 3 hours.
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
  -- First collect the submissions that are eligible for automatic reset.
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

  -- Delete answers first so foreign-key constraints cannot block attempt deletion.
  delete from public.answers
  where attempt_id = any(failed_ids);

  -- Then delete the submissions. Keep assignment_students untouched so the
  -- same assignment becomes available to the student again.
  delete from public.attempts
  where id = any(failed_ids);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

-- This function is for the scheduled database job only.
revoke execute on function private.reset_low_score_submissions() from public, anon, authenticated;

-- 3. Make sure pg_cron is available.
-- If your project does not allow this statement, enable pg_cron from:
-- Supabase Dashboard -> Database -> Extensions -> pg_cron
create extension if not exists pg_cron;

-- 4. Schedule the check every 5 minutes.
-- The job may run a few minutes after the exact 3-hour point.
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

-- 5. Optional: manually test the rule immediately.
-- This deletes any currently existing submission that is already
-- older than 3 hours and below 80%.
-- select private.reset_low_score_submissions();

-- 6. Verification: show currently eligible submissions.
-- Expected result after the job has run: zero rows older than 3 hours
-- with a score below 80%.
select
  id,
  assignment_id,
  student_id,
  score,
  total_questions,
  round((score * 100.0) / nullif(total_questions, 0), 2) as percentage,
  submitted_at
from public.attempts
where submitted_at <= now() - interval '3 hours'
  and total_questions > 0
  and (score * 100) < (total_questions * 80)
order by submitted_at;
