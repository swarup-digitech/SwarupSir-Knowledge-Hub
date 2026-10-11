-- =============================================================================
-- V14 FIX — "violates check constraint student_question_performance_last_result_check"
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor (after V14_OMR_MISTAKES_MIGRATION.sql).
-- Safe to re-run. It changes no data and drops no constraint.
--
-- Cause: your live table stores last_result as TEXT with a CHECK that allows only
-- certain words (for example 'CORRECT' / 'WRONG'). The V14 function wrote the
-- boolean true/false, which became 'true'/'false' and was rejected, so the
-- whole OMR import rolled back.
--
-- Fix: v14_apply_question_result now looks at the real column type and at the
-- words the CHECK allows, and writes the matching one.
--   * boolean column      -> true / false
--   * text + CHECK column -> the allowed word meaning correct / wrong
--   * anything unknown    -> NULL (a CHECK always accepts NULL)
-- Both OMR import and online tests use this function, so both are fixed.
-- =============================================================================

create or replace function public.v14_apply_question_result(
  p_student_id uuid, p_mock_question_id uuid, p_is_correct boolean, p_source text default 'ONLINE'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_def  text;
  m      text[];
  v_val  text := null;     -- value for last_result, as text (cast to the column type below)
begin
  if p_student_id is null or p_mock_question_id is null then return; end if;

  select format_type(a.atttypid, a.atttypmod) into v_type
  from pg_attribute a
  where a.attrelid = 'public.student_question_performance'::regclass
    and a.attname = 'last_result' and not a.attisdropped;

  if v_type = 'boolean' then
    v_val := case when p_is_correct then 'true' else 'false' end;
  else
    -- Read the words the CHECK constraint accepts, e.g. ARRAY['CORRECT'::text, 'WRONG'::text]
    for v_def in
      select pg_get_constraintdef(c.oid)
      from pg_constraint c
      where c.conrelid = 'public.student_question_performance'::regclass
        and c.contype = 'c'
        and pg_get_constraintdef(c.oid) like '%last_result%'
    loop
      for m in select regexp_matches(v_def, '''([^'']*)''', 'g') loop
        if p_is_correct and lower(m[1]) in ('correct','right','true','t','1','yes','y','pass','passed','ok') then
          v_val := m[1];
        elsif (not p_is_correct) and lower(m[1]) in ('wrong','incorrect','false','f','0','no','n','fail','failed','mistake') then
          v_val := m[1];
        end if;
      end loop;
    end loop;
    -- No CHECK found: plain text column, keep the usual words.
    if v_val is null and not exists (
         select 1 from pg_constraint c
         where c.conrelid = 'public.student_question_performance'::regclass
           and c.contype = 'c' and pg_get_constraintdef(c.oid) like '%last_result%') then
      v_val := case when p_is_correct then 'CORRECT' else 'WRONG' end;
    end if;
  end if;

  execute format($q$
    insert into public.student_question_performance
      (student_id, mock_question_id, attempt_count, wrong_count, correct_count,
       last_result, first_wrong_at, last_wrong_at, last_correct_at,
       last_attempted_at, updated_at, correct_streak, last_source)
    values
      ($1, $2, 1,
       case when $3 then 0 else 1 end,
       case when $3 then 1 else 0 end,
       $4::%1$s,
       case when $3 then null else now() end,
       case when $3 then null else now() end,
       case when $3 then now() else null end,
       now(), now(),
       case when $3 then 1 else 0 end,
       $5)
    on conflict (student_id, mock_question_id) do update set
      attempt_count   = student_question_performance.attempt_count + 1,
      wrong_count     = student_question_performance.wrong_count + case when $3 then 0 else 1 end,
      correct_count   = student_question_performance.correct_count + case when $3 then 1 else 0 end,
      last_result     = $4::%1$s,
      first_wrong_at  = case when $3 then student_question_performance.first_wrong_at
                             else coalesce(student_question_performance.first_wrong_at, now()) end,
      last_wrong_at   = case when $3 then student_question_performance.last_wrong_at else now() end,
      last_correct_at = case when $3 then now() else student_question_performance.last_correct_at end,
      last_attempted_at = now(),
      updated_at      = now(),
      correct_streak  = case when $3 then student_question_performance.correct_streak + 1 else 0 end,
      last_source     = $5
  $q$, v_type)
  using p_student_id, p_mock_question_id, p_is_correct, v_val, p_source;
end;
$$;
revoke all on function public.v14_apply_question_result(uuid, uuid, boolean, text) from public, anon, authenticated;

select 'V14 last_result fix applied' as status;
