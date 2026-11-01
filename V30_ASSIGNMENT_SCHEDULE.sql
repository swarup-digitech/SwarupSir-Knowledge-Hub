-- =============================================================================
-- V30: Assignment schedule — start time, end time, extension, publish results
-- Run ONCE in the Supabase SQL Editor (select everything, Run). Safe to run again.
--
--   assignments.start_at              students can open it from this time
--   assignments.end_at                closes at this time (submissions refused afterwards)
--   assignments.results_published_at  answers, answer key and class analytics visible to students
--   assignment_students.extended_end_at   a later end time for ONE student (extension)
--
-- Assignments WITHOUT a start/end time (all your old ones) work exactly as before.
-- Scheduled assignments: one attempt, the student sees the score at once, answers/answer key and
-- analytics only after you publish. The automatic "below 80% → redo after 3 hours" reset is NOT
-- applied to scheduled assignments, so their results stay complete.
-- =============================================================================

-- 1. Columns
alter table public.assignments
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists results_published_at timestamptz;

alter table public.assignment_students
  add column if not exists extended_end_at timestamptz;

alter table public.assignments drop constraint if exists v30_assignment_window_chk;
alter table public.assignments add constraint v30_assignment_window_chk
  check (start_at is null or end_at is null or end_at > start_at);

create index if not exists idx_v30_assignments_end_at on public.assignments(end_at) where end_at is not null;

comment on column public.assignments.start_at is 'V30: students can open the assignment from this time (null = immediately).';
comment on column public.assignments.end_at is 'V30: the assignment closes at this time (null = never). Scheduled = end_at is not null.';
comment on column public.assignments.results_published_at is 'V30: when the teacher published answers/analytics of a scheduled assignment (null = not yet).';
comment on column public.assignment_students.extended_end_at is 'V30: a later end time for this one student.';

-- 2. Helper: is this assignment open for this student right now?
--    p_grace = extra time accepted after the end (for a submission already on its way).
create or replace function public.v30_assert_assignment_open(p_assignment_id uuid, p_student uuid, p_grace interval default interval '0')
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  select a.start_at, greatest(a.end_at, s.extended_end_at)
    into v_start, v_end
  from public.assignments a
  left join public.assignment_students s on s.assignment_id = a.id and s.student_id = p_student
  where a.id = p_assignment_id;

  if v_start is not null and now() < v_start then
    raise exception 'NOT_OPEN_YET: This assignment opens on %.',
      to_char(v_start at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') using errcode = '42501';
  end if;
  if v_end is not null and now() > v_end + coalesce(p_grace, interval '0') then
    raise exception 'CLOSED: This assignment closed on %.',
      to_char(v_end at time zone 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM') using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.v30_assert_assignment_open(uuid, uuid, interval) from public;

-- 3. Questions for the student's current attempt (same as V13 + the time check)
create or replace function public.student_assignment_questions(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.assignment_students s
    where s.assignment_id = p_assignment_id and s.student_id = v_uid
  ) then
    raise exception 'This assignment is not assigned to your account.' using errcode = '42501';
  end if;

  perform public.v30_assert_assignment_open(p_assignment_id, v_uid, interval '0');   -- V30

  return coalesce((
    select jsonb_agg(public.v13_strip_answer_fields(to_jsonb(q))
                     order by q.question_order nulls last, q.id)
    from public.questions q
    where q.assignment_id = p_assignment_id
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.student_assignment_questions(uuid) from public;
grant execute on function public.student_assignment_questions(uuid) to authenticated;

-- 4. Submit (same as V13 + the time check; 5 minutes grace for a submission already on its way)
create or replace function public.student_submit_assignment(
  p_assignment_id uuid,
  p_answers jsonb,
  p_video_completed boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_attempt_no integer;
  v_attempt_id uuid;
  v_total integer;
  v_score integer;
  v_mock_perf jsonb;
  v_school_perf jsonb;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '42501';
  end if;

  select greatest(1, coalesce(s.current_attempt_number, 1))
    into v_attempt_no
  from public.assignment_students s
  where s.assignment_id = p_assignment_id and s.student_id = v_uid
  for update;

  if not found then
    raise exception 'This assignment is no longer assigned to your account.' using errcode = '42501';
  end if;

  perform public.v30_assert_assignment_open(p_assignment_id, v_uid, interval '5 minutes');   -- V30

  if exists (
    select 1 from public.attempts a
    where a.assignment_id = p_assignment_id
      and a.student_id = v_uid
      and a.attempt_number = v_attempt_no
  ) then
    raise exception 'ALREADY_SUBMITTED' using errcode = '23505';
  end if;

  create temporary table if not exists v13_tmp_marking(
    question_id uuid, selected_option text, is_correct boolean,
    src_mock uuid, src_school uuid
  ) on commit drop;
  truncate v13_tmp_marking;

  insert into v13_tmp_marking(question_id, selected_option, is_correct, src_mock, src_school)
  select q.id,
         nullif(upper(trim(sa.selected_option)), ''),
         coalesce(nullif(upper(trim(sa.selected_option)), '') = upper(trim(q.correct_option)), false),
         nullif(to_jsonb(q)->>'source_mock_question_id', '')::uuid,
         nullif(to_jsonb(q)->>'source_school_question_bank_id', '')::uuid
  from public.questions q
  left join lateral (
    select x->>'selected_option' as selected_option
    from jsonb_array_elements(coalesce(p_answers, '[]'::jsonb)) x
    where x->>'question_id' = q.id::text
    limit 1
  ) sa on true
  where q.assignment_id = p_assignment_id;

  select count(*), count(*) filter (where is_correct)
    into v_total, v_score
  from v13_tmp_marking;

  if v_total = 0 then
    raise exception 'No questions are available for this assignment.';
  end if;

  begin
    insert into public.attempts
      (assignment_id, student_id, score, total_questions, video_completed,
       submitted_at, attempt_number)
    values
      (p_assignment_id, v_uid, v_score, v_total, coalesce(p_video_completed, false),
       now(), v_attempt_no)
    returning id into v_attempt_id;
  exception when unique_violation then
    raise exception 'ALREADY_SUBMITTED' using errcode = '23505';
  end;

  insert into public.answers (attempt_id, question_id, selected_option, is_correct)
  select v_attempt_id, question_id, selected_option, is_correct
  from v13_tmp_marking;

  select coalesce(jsonb_agg(jsonb_build_object('mock_question_id', src_mock, 'is_correct', is_correct)), '[]'::jsonb)
    into v_mock_perf from v13_tmp_marking where src_mock is not null;
  select coalesce(jsonb_agg(jsonb_build_object('source_school_question_bank_id', src_school, 'is_correct', is_correct)), '[]'::jsonb)
    into v_school_perf from v13_tmp_marking where src_school is not null;

  if jsonb_array_length(v_mock_perf) > 0 then
    begin
      perform public.record_student_question_results(v_uid, v_mock_perf);
    exception when others then
      raise warning 'record_student_question_results failed: %', sqlerrm;
    end;
  end if;
  if jsonb_array_length(v_school_perf) > 0 then
    begin
      perform public.record_school_student_question_results(v_uid, v_school_perf);
    exception when others then
      raise warning 'record_school_student_question_results failed: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'score', v_score,
    'total_questions', v_total,
    'attempt_number', v_attempt_no
  );
end;
$$;
revoke all on function public.student_submit_assignment(uuid, jsonb, boolean) from public;
grant execute on function public.student_submit_assignment(uuid, jsonb, boolean) to authenticated;

-- 5. Review (answer key, explanations): for a scheduled assignment only after the results are published
create or replace function public.student_attempt_review_questions(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_assignment uuid;
  v_end timestamptz;
  v_pub timestamptz;
begin
  select a.assignment_id, s.end_at, s.results_published_at into v_assignment, v_end, v_pub
  from public.attempts a
  join public.assignments s on s.id = a.assignment_id
  where a.id = p_attempt_id
    and a.student_id = v_uid
    and a.submitted_at is not null;

  if v_assignment is null then
    raise exception 'Submission not found.' using errcode = '42501';
  end if;
  if v_end is not null and v_pub is null then                                  -- V30
    raise exception 'RESULTS_NOT_PUBLISHED: The answers will be shown when your teacher publishes the results.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(q) order by q.question_order nulls last, q.id)
    from public.questions q
    where q.assignment_id = v_assignment
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.student_attempt_review_questions(uuid) from public;
grant execute on function public.student_attempt_review_questions(uuid) to authenticated;

-- 6. Class analytics for a student, after publishing (no names, only numbers).
--    Personal (adaptive) assignments of one batch are counted together.
create or replace function public.student_assignment_analytics(p_assignment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_a record;
  v_res jsonb;
begin
  select a.* into v_a from public.assignments a
  join public.assignment_students s on s.assignment_id = a.id and s.student_id = v_uid
  where a.id = p_assignment_id;
  if not found then
    raise exception 'This assignment is not assigned to your account.' using errcode = '42501';
  end if;
  if v_a.end_at is not null and v_a.results_published_at is null then
    raise exception 'RESULTS_NOT_PUBLISHED' using errcode = '42501';
  end if;

  with ids as (
    select a.id from public.assignments a
    where a.id = p_assignment_id
       or (v_a.adaptive_batch_id is not null and a.adaptive_batch_id = v_a.adaptive_batch_id)
  ), latest as (            -- each student's latest submitted attempt
    select distinct on (t.student_id) t.student_id,
           case when t.total_questions > 0 then round(t.score * 100.0 / t.total_questions, 1) else 0 end as pct
    from public.attempts t
    where t.assignment_id in (select id from ids) and t.submitted_at is not null
    order by t.student_id, t.submitted_at desc
  ), assigned as (
    select count(distinct s.student_id) n from public.assignment_students s where s.assignment_id in (select id from ids)
  ), me as (select pct from latest where student_id = v_uid)
  select jsonb_build_object(
    'assigned',  (select n from assigned),
    'submitted', (select count(*) from latest),
    'average',   (select round(avg(pct), 1) from latest),
    'highest',   (select max(pct) from latest),
    'lowest',    (select min(pct) from latest),
    'my_percent',(select pct from me),
    'my_rank',   case when (select pct from me) is null then null
                      else (select 1 + count(*) from latest where pct > (select pct from me)) end,
    'at_least_80',(select count(*) from latest where pct >= 80)
  ) into v_res;
  return v_res;
end;
$$;
revoke all on function public.student_assignment_analytics(uuid) from public;
grant execute on function public.student_assignment_analytics(uuid) to authenticated;

-- 7. The automatic low-score reset (only if it exists in your project): skip scheduled assignments
do $$
begin
  if to_regprocedure('private.reset_low_score_submissions()') is not null then
    execute $f$
      create or replace function private.reset_low_score_submissions()
      returns integer
      language plpgsql
      security definer
      set search_path = ''
      as $body$
      declare
        failed_ids uuid[];
        deleted_count integer := 0;
      begin
        select coalesce(array_agg(t.id), '{}'::uuid[])
          into failed_ids
        from public.attempts t
        where t.submitted_at is not null
          and t.submitted_at <= now() - interval '3 hours'
          and t.total_questions > 0
          and (t.score * 100) < (t.total_questions * 80)
          and not exists (select 1 from public.assignments a          -- V30: keep scheduled results
                          where a.id = t.assignment_id and a.end_at is not null);

        if cardinality(failed_ids) = 0 then
          return 0;
        end if;

        delete from public.answers where attempt_id = any(failed_ids);
        delete from public.attempts where id = any(failed_ids);
        get diagnostics deleted_count = row_count;
        return deleted_count;
      end;
      $body$;
    $f$;
    execute 'revoke execute on function private.reset_low_score_submissions() from public, anon, authenticated';
  end if;
end $$;

-- 8. Teacher: extend the end time for chosen students only (null = remove the extension)
create or replace function public.teacher_extend_assignment_students(p_assignment_id uuid, p_student_ids uuid[], p_until timestamptz)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if auth.uid() is null then
    raise exception 'Please log in again.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.assignments a
    where a.id = p_assignment_id
      and (a.created_by = auth.uid()
           or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher' and coalesce(p.is_admin, false)))
  ) then
    raise exception 'You can only extend your own assignments.' using errcode = '42501';
  end if;
  update public.assignment_students
     set extended_end_at = p_until
   where assignment_id = p_assignment_id
     and student_id = any (coalesce(p_student_ids, '{}'));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;
revoke all on function public.teacher_extend_assignment_students(uuid, uuid[], timestamptz) from public;
grant execute on function public.teacher_extend_assignment_students(uuid, uuid[], timestamptz) to authenticated;

notify pgrst, 'reload schema';

select 'V30 assignment schedule installed' as status,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='assignments'
           and column_name in ('start_at','end_at','results_published_at')) as new_assignment_columns_of_3,
       (to_regprocedure('private.reset_low_score_submissions()') is not null) as low_score_reset_exists;
