-- =============================================================================
-- V13 — Secure scoring, hidden answer keys and database hardening
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor, BEFORE uploading the V13 main.html.
-- Safe to re-run.  It does not delete or change any existing data.
--
-- What it does
--   1. Students can no longer read answer keys while a test is running.
--      (questions / mock_test_questions are served through functions that
--      strip correct_option, explanation and solutions.)
--   2. Marks are calculated by the database, not in the browser.  Students
--      can no longer insert/update their own scores, attempts or the timer.
--   3. Mock-test answers can only be saved while the attempt is running
--      (deadline + 2 minutes grace).
--   4. Students cannot change their own profiles.role (no self-promotion
--      to teacher) and cannot create classes.
--   5. The two *_duplicate_cleanup_backup tables are locked.
--
-- How it works
--   Existing policies are NOT dropped.  V13 adds RESTRICTIVE policies, which
--   Postgres combines with AND on top of whatever policies already exist.
--   Teachers are unaffected; only accounts whose profiles.role = 'student'
--   are restricted.
--
-- Requires (already in your project): profiles, assignments,
-- assignment_students (current_attempt_number), questions, attempts
-- (attempt_number), answers, mock_tests (results_released), mock_test_*,
-- record_student_question_results, record_school_student_question_results.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Helper: is the caller a student?
-- ---------------------------------------------------------------------------
create or replace function public.v13_is_student()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'student'
  );
$$;
revoke all on function public.v13_is_student() from public;
grant execute on function public.v13_is_student() to authenticated;

-- ---------------------------------------------------------------------------
-- 1. Lock the backup tables (they contained copies of attempts/answers and
--    had no row-level security).  Only the service role / SQL editor can
--    read them now.
-- ---------------------------------------------------------------------------
alter table if exists public.attempts_duplicate_cleanup_backup enable row level security;
alter table if exists public.answers_duplicate_cleanup_backup  enable row level security;
do $$
begin
  if to_regclass('public.attempts_duplicate_cleanup_backup') is not null then
    execute 'revoke all on public.attempts_duplicate_cleanup_backup from anon, authenticated';
  end if;
  if to_regclass('public.answers_duplicate_cleanup_backup') is not null then
    execute 'revoke all on public.answers_duplicate_cleanup_backup from anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Profiles: nobody can change their OWN role from the app.
--    (Service role / SQL editor / Edge Function are unaffected.)
-- ---------------------------------------------------------------------------
create or replace function public.v13_guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for the SQL editor and for the service-role key.
  if auth.uid() is not null
     and coalesce(auth.role(), '') <> 'service_role'
     and new.role is distinct from old.role then
    raise exception 'Changing an account role is not allowed from the app.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_v13_guard_profile_role on public.profiles;
create trigger trg_v13_guard_profile_role
before update on public.profiles
for each row execute function public.v13_guard_profile_role();

-- Students cannot insert profile rows directly (the Edge Function uses the
-- service role, which bypasses RLS).
drop policy if exists v13_profiles_no_student_insert on public.profiles;
create policy v13_profiles_no_student_insert on public.profiles
as restrictive for insert to authenticated
with check (not public.v13_is_student());

-- ---------------------------------------------------------------------------
-- 3. Classes / memberships: students cannot create or change them.
--    (Prevents a student from creating a class to pass the Edge Function's
--    "owns a class" teacher check.)
-- ---------------------------------------------------------------------------
drop policy if exists v13_classes_no_student_insert on public.classes;
create policy v13_classes_no_student_insert on public.classes
as restrictive for insert to authenticated
with check (not public.v13_is_student());

drop policy if exists v13_classes_no_student_update on public.classes;
create policy v13_classes_no_student_update on public.classes
as restrictive for update to authenticated
using (not public.v13_is_student());

drop policy if exists v13_classes_no_student_delete on public.classes;
create policy v13_classes_no_student_delete on public.classes
as restrictive for delete to authenticated
using (not public.v13_is_student());

drop policy if exists v13_class_students_no_student_insert on public.class_students;
create policy v13_class_students_no_student_insert on public.class_students
as restrictive for insert to authenticated
with check (not public.v13_is_student());

drop policy if exists v13_class_students_no_student_update on public.class_students;
create policy v13_class_students_no_student_update on public.class_students
as restrictive for update to authenticated
using (not public.v13_is_student());

drop policy if exists v13_class_students_no_student_delete on public.class_students;
create policy v13_class_students_no_student_delete on public.class_students
as restrictive for delete to authenticated
using (not public.v13_is_student());

-- ---------------------------------------------------------------------------
-- 4. Assignments (questions / attempts / answers)
-- ---------------------------------------------------------------------------
-- 4a. Students may not read the questions table directly any more.
drop policy if exists v13_questions_no_student_select on public.questions;
create policy v13_questions_no_student_select on public.questions
as restrictive for select to authenticated
using (not public.v13_is_student());

-- 4b. Students may not write attempts or answers directly.
drop policy if exists v13_attempts_no_student_insert on public.attempts;
create policy v13_attempts_no_student_insert on public.attempts
as restrictive for insert to authenticated
with check (not public.v13_is_student());

drop policy if exists v13_attempts_no_student_update on public.attempts;
create policy v13_attempts_no_student_update on public.attempts
as restrictive for update to authenticated
using (not public.v13_is_student());

drop policy if exists v13_attempts_no_student_delete on public.attempts;
create policy v13_attempts_no_student_delete on public.attempts
as restrictive for delete to authenticated
using (not public.v13_is_student());

drop policy if exists v13_answers_no_student_insert on public.answers;
create policy v13_answers_no_student_insert on public.answers
as restrictive for insert to authenticated
with check (not public.v13_is_student());

drop policy if exists v13_answers_no_student_update on public.answers;
create policy v13_answers_no_student_update on public.answers
as restrictive for update to authenticated
using (not public.v13_is_student());

drop policy if exists v13_answers_no_student_delete on public.answers;
create policy v13_answers_no_student_delete on public.answers
as restrictive for delete to authenticated
using (not public.v13_is_student());

-- Columns that reveal the answer.  They are removed from what a student
-- receives while answering.
create or replace function public.v13_strip_answer_fields(j jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(j, '{}'::jsonb)
    - 'correct_option' - 'correct_answer' - 'explanation'
    - 'solution_image_url' - 'solution_video_url' - 'solution_text'
    - 'answer_key';
$$;

-- 4c. Questions for the student's CURRENT attempt (no answer key).
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

-- 4d. Submit an assignment.  The database marks it.
--     p_answers = [{"question_id": "...", "selected_option": "A"}, ...]
--     selected_option must be the ORIGINAL option letter (before any
--     on-screen shuffling).
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

  if exists (
    select 1 from public.attempts a
    where a.assignment_id = p_assignment_id
      and a.student_id = v_uid
      and a.attempt_number = v_attempt_no
  ) then
    raise exception 'ALREADY_SUBMITTED' using errcode = '23505';
  end if;

  -- Marking: one mark per correct question (same rule as before).
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

  -- Mistake-bank statistics (never block the submission).
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

-- 4e. Review after submission: full questions (with answer key, explanation,
--     solutions) for a SUBMITTED attempt that belongs to the student.
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
begin
  select a.assignment_id into v_assignment
  from public.attempts a
  where a.id = p_attempt_id
    and a.student_id = v_uid
    and a.submitted_at is not null;

  if v_assignment is null then
    raise exception 'Submission not found.' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- 5. Mock tests
-- ---------------------------------------------------------------------------
-- 5-pre. Clean up the OLD policy set from mock_question_bank_migration.sql.
--   Those policies (a) cause "infinite recursion detected in policy for
--   relation mock_tests" and (b) contain an unqualified-column bug
--   (s.mock_test_id = mock_test_id compares the column with itself), which
--   let a student read the questions of EVERY mock test once assigned to one.
--   mock_test.sql already replaced them with a safe set; this makes sure the
--   old ones are really gone and the safe set exists.
drop policy if exists mock_bank_teacher_select            on public.mock_question_bank;
drop policy if exists mock_bank_teacher_insert            on public.mock_question_bank;
drop policy if exists mock_bank_teacher_update            on public.mock_question_bank;
drop policy if exists mock_bank_teacher_delete            on public.mock_question_bank;
drop policy if exists mock_tests_teacher_all              on public.mock_tests;
drop policy if exists mock_tests_student_select           on public.mock_tests;
drop policy if exists mock_test_questions_teacher_all     on public.mock_test_questions;
drop policy if exists mock_test_questions_student_select  on public.mock_test_questions;
drop policy if exists mock_test_students_teacher_all      on public.mock_test_students;
drop policy if exists mock_test_students_student_select   on public.mock_test_students;
drop policy if exists mock_attempts_teacher_select        on public.mock_test_attempts;
drop policy if exists mock_attempts_student_select        on public.mock_test_attempts;
drop policy if exists mock_attempts_student_insert        on public.mock_test_attempts;
drop policy if exists mock_attempts_student_update        on public.mock_test_attempts;
drop policy if exists mock_test_answers_student_all       on public.mock_test_answers;

create or replace function public.is_mock_test_teacher(p_mock_test_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mock_tests t where t.id = p_mock_test_id and t.teacher_id = auth.uid());
$$;
create or replace function public.is_mock_test_assigned(p_mock_test_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mock_test_students s where s.mock_test_id = p_mock_test_id and s.student_id = auth.uid());
$$;
create or replace function public.is_mock_attempt_teacher(p_attempt_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mock_test_attempts a join public.mock_tests t on t.id = a.mock_test_id
                 where a.id = p_attempt_id and t.teacher_id = auth.uid());
$$;

drop policy if exists "mock bank teacher manage" on public.mock_question_bank;
create policy "mock bank teacher manage" on public.mock_question_bank
for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "mock tests teacher manage" on public.mock_tests;
create policy "mock tests teacher manage" on public.mock_tests
for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists "mock test questions teacher manage" on public.mock_test_questions;
create policy "mock test questions teacher manage" on public.mock_test_questions
for all to authenticated
using (public.is_mock_test_teacher(mock_test_id)) with check (public.is_mock_test_teacher(mock_test_id));

drop policy if exists "mock recipients teacher manage" on public.mock_test_students;
create policy "mock recipients teacher manage" on public.mock_test_students
for all to authenticated
using (public.is_mock_test_teacher(mock_test_id)) with check (public.is_mock_test_teacher(mock_test_id));

drop policy if exists "mock attempts teacher read" on public.mock_test_attempts;
create policy "mock attempts teacher read" on public.mock_test_attempts
for select to authenticated using (public.is_mock_test_teacher(mock_test_id));

drop policy if exists "mock answers teacher read" on public.mock_test_answers;
create policy "mock answers teacher read" on public.mock_test_answers
for select to authenticated using (public.is_mock_attempt_teacher(attempt_id));

drop policy if exists "mock tests student assigned read" on public.mock_tests;
create policy "mock tests student assigned read" on public.mock_tests
for select to authenticated using (public.is_mock_test_assigned(id));

-- Students no longer read mock_test_questions directly (see 5a).
drop policy if exists "mock test questions student read" on public.mock_test_questions;

drop policy if exists "mock recipients student read own" on public.mock_test_students;
create policy "mock recipients student read own" on public.mock_test_students
for select to authenticated using (student_id = auth.uid());

-- Students: read own attempts only (writes go through functions below).
drop policy if exists "mock attempts student own" on public.mock_test_attempts;
create policy "mock attempts student own" on public.mock_test_attempts
for select to authenticated using (student_id = auth.uid());

drop policy if exists "mock answers student own" on public.mock_test_answers;
create policy "mock answers student own" on public.mock_test_answers
for all to authenticated
using (exists (select 1 from public.mock_test_attempts a where a.id = attempt_id and a.student_id = auth.uid()))
with check (exists (select 1 from public.mock_test_attempts a where a.id = attempt_id and a.student_id = auth.uid()));

-- 5a. Students may not read mock_test_questions directly.
drop policy if exists v13_mock_questions_no_student_select on public.mock_test_questions;
create policy v13_mock_questions_no_student_select on public.mock_test_questions
as restrictive for select to authenticated
using (not public.v13_is_student());

-- 5b. Students may not create/change attempts directly (start & submit are
--     done by the functions below, which also set the server deadline).
drop policy if exists v13_mock_attempts_no_student_insert on public.mock_test_attempts;
create policy v13_mock_attempts_no_student_insert on public.mock_test_attempts
as restrictive for insert to authenticated
with check (not public.v13_is_student());

drop policy if exists v13_mock_attempts_no_student_update on public.mock_test_attempts;
create policy v13_mock_attempts_no_student_update on public.mock_test_attempts
as restrictive for update to authenticated
using (not public.v13_is_student());

drop policy if exists v13_mock_attempts_no_student_delete on public.mock_test_attempts;
create policy v13_mock_attempts_no_student_delete on public.mock_test_attempts
as restrictive for delete to authenticated
using (not public.v13_is_student());

-- 5c. Answers can be saved only while the attempt is running
--     (until the deadline + 2 minutes for slow networks).
create or replace function public.v13_mock_attempt_open(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mock_test_attempts a
    where a.id = p_attempt_id
      and a.student_id = auth.uid()
      and a.status = 'in_progress'
      and now() <= a.end_at + interval '2 minutes'
  );
$$;
revoke all on function public.v13_mock_attempt_open(uuid) from public;
grant execute on function public.v13_mock_attempt_open(uuid) to authenticated;

drop policy if exists v13_mock_answers_student_insert_open on public.mock_test_answers;
create policy v13_mock_answers_student_insert_open on public.mock_test_answers
as restrictive for insert to authenticated
with check (not public.v13_is_student() or public.v13_mock_attempt_open(attempt_id));

drop policy if exists v13_mock_answers_student_update_open on public.mock_test_answers;
create policy v13_mock_answers_student_update_open on public.mock_test_answers
as restrictive for update to authenticated
using (not public.v13_is_student() or public.v13_mock_attempt_open(attempt_id))
with check (not public.v13_is_student() or public.v13_mock_attempt_open(attempt_id));

drop policy if exists v13_mock_answers_no_student_delete on public.mock_test_answers;
create policy v13_mock_answers_no_student_delete on public.mock_test_answers
as restrictive for delete to authenticated
using (not public.v13_is_student());

-- 5d. Submit (mark) a mock attempt.  Used by the student and also called
--     automatically when an expired attempt is found.
create or replace function public.student_mock_submit(p_attempt_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  a public.mock_test_attempts%rowtype;
  v_score numeric := 0;
  v_total_marks numeric;
  v_sections jsonb;
  v_perf jsonb;
begin
  select * into a
  from public.mock_test_attempts
  where id = p_attempt_id and student_id = v_uid
  for update;

  if not found then
    raise exception 'Mock Test attempt not found.' using errcode = '42501';
  end if;

  if a.status = 'submitted' then
    return jsonb_build_object('attempt_id', a.id, 'status', a.status, 'already_submitted', true);
  end if;

  create temporary table if not exists v13_tmp_mock(
    section_code text, marks numeric, is_correct boolean, bank_question_id uuid
  ) on commit drop;
  truncate v13_tmp_mock;

  insert into v13_tmp_mock(section_code, marks, is_correct, bank_question_id)
  select q.section_code,
         coalesce(q.marks, 1.25),
         coalesce(upper(ans.selected_option) = upper(q.correct_option), false),
         q.bank_question_id
  from public.mock_test_questions q
  left join public.mock_test_answers ans
    on ans.attempt_id = a.id and ans.question_id = q.id
  where q.mock_test_id = a.mock_test_id;

  select coalesce(sum(marks) filter (where is_correct), 0) into v_score from v13_tmp_mock;

  select coalesce(jsonb_object_agg(section_code, jsonb_build_object(
           'correct',   cnt_ok,
           'questions', cnt,
           'marks',     mk)), '{}'::jsonb)
    into v_sections
  from (
    select section_code,
           count(*) as cnt,
           count(*) filter (where is_correct) as cnt_ok,
           coalesce(sum(marks) filter (where is_correct), 0) as mk
    from v13_tmp_mock
    group by section_code
  ) s;

  v_total_marks := nullif(coalesce(a.total_marks, 100), 0);

  update public.mock_test_attempts
  set status = 'submitted',
      submitted_at = now(),
      score = round(v_score, 2),
      percentage = round(v_score * 100 / coalesce(v_total_marks, 100), 2),
      section_results = v_sections
  where id = a.id;

  select coalesce(jsonb_agg(jsonb_build_object('mock_question_id', bank_question_id, 'is_correct', is_correct)), '[]'::jsonb)
    into v_perf from v13_tmp_mock where bank_question_id is not null;
  if jsonb_array_length(v_perf) > 0 then
    begin
      perform public.record_student_question_results(v_uid, v_perf);
    exception when others then
      raise warning 'record_student_question_results failed: %', sqlerrm;
    end;
  end if;

  return jsonb_build_object('attempt_id', a.id, 'status', 'submitted');
end;
$$;
revoke all on function public.student_mock_submit(uuid) from public;
grant execute on function public.student_mock_submit(uuid) to authenticated;

-- 5e. Start (or resume) a mock test.  The deadline is set by the server.
--     Returns { attempt, test, questions (no answer key), answers }.
--     If the test was already submitted, returns { submitted_attempt_id }.
create or replace function public.student_mock_start(p_mock_test_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  t public.mock_tests%rowtype;
  a public.mock_test_attempts%rowtype;
  v_done uuid;
begin
  if v_uid is null then
    raise exception 'Please log in again.' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.mock_test_students s
    where s.mock_test_id = p_mock_test_id and s.student_id = v_uid
  ) then
    raise exception 'This Mock Test is not assigned to you.' using errcode = '42501';
  end if;

  select * into t from public.mock_tests where id = p_mock_test_id;
  if not found then
    raise exception 'Mock Test not found.';
  end if;

  -- Serialise concurrent "Start" clicks for the same student/test.
  perform pg_advisory_xact_lock(hashtext('mock:' || p_mock_test_id::text || ':' || v_uid::text));

  -- Auto-submit any expired running attempt.
  for a in
    select * from public.mock_test_attempts
    where mock_test_id = p_mock_test_id and student_id = v_uid
      and status = 'in_progress' and end_at <= now()
  loop
    perform public.student_mock_submit(a.id);
  end loop;

  select id into v_done
  from public.mock_test_attempts
  where mock_test_id = p_mock_test_id and student_id = v_uid and status = 'submitted'
  order by submitted_at desc nulls last
  limit 1;
  if v_done is not null then
    return jsonb_build_object('submitted_attempt_id', v_done);
  end if;

  select * into a
  from public.mock_test_attempts
  where mock_test_id = p_mock_test_id and student_id = v_uid and status = 'in_progress'
  order by created_at desc
  limit 1;

  if not found then
    insert into public.mock_test_attempts
      (mock_test_id, student_id, start_at, end_at, status, total_questions, total_marks)
    values
      (p_mock_test_id, v_uid, now(),
       now() + make_interval(secs => greatest(60, coalesce(t.time_limit_seconds, 7200))),
       'in_progress',
       coalesce(t.total_questions, 80), coalesce(t.total_marks, 100))
    returning * into a;
  end if;

  return jsonb_build_object(
    'attempt', to_jsonb(a),
    'test', to_jsonb(t),
    'questions', coalesce((
      select jsonb_agg(public.v13_strip_answer_fields(to_jsonb(q)) order by q.question_number)
      from public.mock_test_questions q
      where q.mock_test_id = p_mock_test_id
    ), '[]'::jsonb),
    'answers', coalesce((
      select jsonb_object_agg(x.question_id::text, x.selected_option)
      from public.mock_test_answers x
      where x.attempt_id = a.id
    ), '{}'::jsonb),
    'server_now', now()
  );
end;
$$;
revoke all on function public.student_mock_start(uuid) from public;
grant execute on function public.student_mock_start(uuid) to authenticated;

-- 5f. Answer key for a submitted attempt — only after the teacher has
--     approved/released results.
create or replace function public.student_mock_result_questions(p_attempt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_test uuid;
  v_released boolean;
begin
  select a.mock_test_id, coalesce((to_jsonb(t)->>'results_released')::boolean, false)
    into v_test, v_released
  from public.mock_test_attempts a
  join public.mock_tests t on t.id = a.mock_test_id
  where a.id = p_attempt_id
    and a.student_id = v_uid
    and a.status = 'submitted';

  if v_test is null then
    raise exception 'Result not found.' using errcode = '42501';
  end if;
  if not v_released then
    raise exception 'Your result has not yet been approved by the teacher.';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id,
             'question_number', q.question_number,
             'section_code', q.section_code,
             'part_code', q.part_code,
             'correct_option', q.correct_option,
             'marks', q.marks) order by q.question_number)
    from public.mock_test_questions q
    where q.mock_test_id = v_test
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.student_mock_result_questions(uuid) from public;
grant execute on function public.student_mock_result_questions(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Fee bulk import: duplicate-protection support index (speeds up the
--    duplicate check used by the Edge Function).
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.student_fee_payments') is not null then
    execute 'create index if not exists idx_v13_fee_payment_dup
             on public.student_fee_payments(fee_account_id, student_id, payment_date, amount)';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Student login rate limit (used by the create-students Edge Function).
--    Only the service role can use this table.
-- ---------------------------------------------------------------------------
create table if not exists public.edge_login_attempts (
  id bigserial primary key,
  roll_no text not null,
  ip text,
  attempted_at timestamptz not null default now()
);
create index if not exists idx_edge_login_attempts_roll on public.edge_login_attempts(roll_no, attempted_at desc);
create index if not exists idx_edge_login_attempts_ip   on public.edge_login_attempts(ip, attempted_at desc);
alter table public.edge_login_attempts enable row level security;
revoke all on public.edge_login_attempts from anon, authenticated;

select 'V13 secure scoring migration complete' as status;
