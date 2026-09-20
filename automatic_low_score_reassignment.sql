-- SWARUP SIR'S KNOWLEDGE HUB
-- Automatic low-score retry — PRESERVED
--
-- Rule:
--   If a submitted assignment score is BELOW 80%, the submission is removed
--   after 3 hours. The assignment_students row is kept, so the same current
--   attempt becomes available again.
--   A score of exactly 80% is NOT reset.
--
-- This works together with single_submission_until_reassigned.sql:
--   * double-click/simultaneous submissions are blocked by the unique index;
--   * teacher re-assignment can explicitly open a new attempt;
--   * low scores can still automatically become available again after 3 hours.

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

-- Optional manual test:
-- select private.reset_low_score_submissions();
