-- =============================================================================
-- V14 — OMR results in the Mistake Bank + "fixed after two correct in a row"
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor (after V13). Safe to re-run.
--
--  1. student_question_performance gets  correct_streak  (how many times in a
--     row the student has answered the question correctly).
--     A question is an ACTIVE MISTAKE when  wrong_count > 0  and
--     correct_streak < 2.  Two correct answers in a row = fixed.
--     Any wrong / unanswered answer resets the streak to 0.
--  2. omr_imports / omr_responses keep every imported OMR answer
--     (paper, set, question, student answer, key).
--  3. teacher_import_omr_results(...) — teacher-only function that marks an
--     OMR Excel against the SAVED answer key of a generated question paper
--     and adds the results to each student's Mistake Bank.
--     The same student cannot be imported twice for the same paper.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Streak column + shared "apply one result" function
-- ---------------------------------------------------------------------------
alter table public.student_question_performance
  add column if not exists correct_streak integer not null default 0;
alter table public.student_question_performance
  add column if not exists last_source text;          -- 'ONLINE' or 'OMR'

-- First run only: start existing rows from their last result.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_description d
                 join pg_catalog.pg_class c on c.oid = d.objoid
                 where c.relname = 'student_question_performance'
                   and d.description like 'v14:%') then
    update public.student_question_performance
       -- last_result may be boolean or text in older projects
       set correct_streak = case when lower(coalesce(last_result::text,'')) in ('true','t','1','yes','y','correct') then 1 else 0 end;
    comment on table public.student_question_performance is
      'v14: correct_streak added (active mistake = wrong_count>0 and correct_streak<2)';
  end if;
end $$;

create index if not exists idx_sqp_active_mistakes
  on public.student_question_performance(student_id, correct_streak, wrong_count desc);

create or replace function public.v14_apply_question_result(
  p_student_id uuid, p_mock_question_id uuid, p_is_correct boolean, p_source text default 'ONLINE'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_student_id is null or p_mock_question_id is null then return; end if;
  insert into public.student_question_performance
    (student_id, mock_question_id, attempt_count, wrong_count, correct_count,
     last_result, first_wrong_at, last_wrong_at, last_correct_at,
     last_attempted_at, updated_at, correct_streak, last_source)
  values
    (p_student_id, p_mock_question_id, 1,
     case when p_is_correct then 0 else 1 end,
     case when p_is_correct then 1 else 0 end,
     p_is_correct,
     case when p_is_correct then null else now() end,
     case when p_is_correct then null else now() end,
     case when p_is_correct then now() else null end,
     now(), now(),
     case when p_is_correct then 1 else 0 end,
     p_source)
  on conflict (student_id, mock_question_id) do update set
    attempt_count   = student_question_performance.attempt_count + 1,
    wrong_count     = student_question_performance.wrong_count + case when p_is_correct then 0 else 1 end,
    correct_count   = student_question_performance.correct_count + case when p_is_correct then 1 else 0 end,
    last_result     = p_is_correct,
    first_wrong_at  = case when p_is_correct then student_question_performance.first_wrong_at
                           else coalesce(student_question_performance.first_wrong_at, now()) end,
    last_wrong_at   = case when p_is_correct then student_question_performance.last_wrong_at else now() end,
    last_correct_at = case when p_is_correct then now() else student_question_performance.last_correct_at end,
    last_attempted_at = now(),
    updated_at      = now(),
    correct_streak  = case when p_is_correct then student_question_performance.correct_streak + 1 else 0 end,
    last_source     = p_source;
end;
$$;
revoke all on function public.v14_apply_question_result(uuid, uuid, boolean, text) from public, anon, authenticated;

-- Same signature as before (used by online tests); now keeps the streak.
create or replace function public.record_student_question_results(
  p_student_id uuid,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is distinct from p_student_id then
    raise exception 'Not authorized';
  end if;
  for r in
    select * from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
      as x(mock_question_id uuid, is_correct boolean)
    where mock_question_id is not null
  loop
    perform public.v14_apply_question_result(p_student_id, r.mock_question_id, coalesce(r.is_correct, false), 'ONLINE');
  end loop;
end;
$$;
revoke all on function public.record_student_question_results(uuid, jsonb) from public;
grant execute on function public.record_student_question_results(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. OMR import history
-- ---------------------------------------------------------------------------
create table if not exists public.omr_imports (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  paper_base_serial text not null,
  exam_title text,
  file_name text,
  imported_at timestamptz not null default now(),
  student_count integer not null default 0,
  question_count integer not null default 0,
  skipped_questions jsonb not null default '[]'::jsonb
);
create index if not exists idx_omr_imports_teacher on public.omr_imports(teacher_id, imported_at desc);

create table if not exists public.omr_responses (
  id bigserial primary key,
  import_id uuid not null references public.omr_imports(id) on delete cascade,
  paper_base_serial text not null,
  student_id uuid not null references public.profiles(id) on delete cascade,
  set_code text not null,
  question_no integer not null,
  mock_question_id uuid references public.mock_question_bank(id) on delete set null,
  selected_option text,          -- as on the sheet (blank, A–D, or e.g. "A, C")
  correct_option text,
  is_correct boolean not null,
  unique (paper_base_serial, student_id, question_no)
);
create index if not exists idx_omr_responses_student on public.omr_responses(student_id);

alter table public.omr_imports enable row level security;
alter table public.omr_responses enable row level security;

drop policy if exists omr_imports_teacher_read on public.omr_imports;
create policy omr_imports_teacher_read on public.omr_imports
for select to authenticated using (teacher_id = auth.uid());

drop policy if exists omr_responses_teacher_read on public.omr_responses;
create policy omr_responses_teacher_read on public.omr_responses
for select to authenticated
using (exists (select 1 from public.omr_imports i where i.id = import_id and i.teacher_id = auth.uid()));

drop policy if exists omr_responses_student_read on public.omr_responses;
create policy omr_responses_student_read on public.omr_responses
for select to authenticated using (student_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Teacher import
--   p_rows: [{ "roll_no":"1040", "set_code":"C",
--              "answers":["C","C","B", ... ],     -- index 0 = Q1 ('' = blank)
--              "sheet_keys":["C","C","A", ... ] }] -- key printed on the OMR sheet
--   A question is SKIPPED (not counted) when the key on the OMR sheet differs
--   from the saved answer key — e.g. a corrected/bonus question.
--   p_dry_run = true only checks and reports; nothing is written.
-- ---------------------------------------------------------------------------
create or replace function public.teacher_import_omr_results(
  p_paper_base_serial text,
  p_exam_title text,
  p_file_name text,
  p_rows jsonb,
  p_dry_run boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_import uuid;
  r jsonb;
  v_roll text; v_set text;
  v_student uuid; v_name text;
  v_paper_id uuid;
  v_keys jsonb;
  v_n int; i int;
  v_sel text; v_sel_raw text; v_sheet_key text; v_key text; v_qid uuid; v_ok boolean;
  v_report jsonb := '[]'::jsonb;
  v_imported int := 0; v_wrong int; v_right int; v_skipped int;
  v_skipped_all jsonb := '[]'::jsonb;
  v_qcount int := 0;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and lower(coalesce(role,'')) = 'teacher') then
    raise exception 'Only teachers can import OMR results.' using errcode = '42501';
  end if;
  if coalesce(trim(p_paper_base_serial), '') = '' then
    raise exception 'Select the question paper (Serial No).';
  end if;
  if not exists (select 1 from public.jnvst_generated_question_papers
                 where teacher_id = v_uid
                   and (serial_no = p_paper_base_serial or serial_no like p_paper_base_serial || '-_')) then
    raise exception 'Question paper % was not found in your Generated Question Paper history.', p_paper_base_serial;
  end if;

  if not p_dry_run then
    insert into public.omr_imports(teacher_id, paper_base_serial, exam_title, file_name)
    values (v_uid, p_paper_base_serial, nullif(trim(p_exam_title),''), nullif(trim(p_file_name),''))
    returning id into v_import;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_roll := trim(coalesce(r->>'roll_no', ''));
    v_set  := upper(trim(coalesce(r->>'set_code', '')));

    -- student must be in one of this teacher's classes
    select p.id, p.full_name into v_student, v_name
    from public.profiles p
    where p.roll_no = v_roll and lower(coalesce(p.role,'')) = 'student'
      and exists (select 1 from public.class_students cs join public.classes c on c.id = cs.class_id
                  where cs.student_id = p.id and c.teacher_id = v_uid)
    limit 1;

    if v_student is null then
      v_report := v_report || jsonb_build_object('roll_no', v_roll, 'status', 'student_not_found');
      continue;
    end if;

    select g.id, coalesce(g.answer_key_snapshot->'rows', '[]'::jsonb) into v_paper_id, v_keys
    from public.jnvst_generated_question_papers g
    where g.teacher_id = v_uid
      and (g.serial_no = p_paper_base_serial or g.serial_no like p_paper_base_serial || '-_')
      and upper(coalesce(g.set_code,'A')) = v_set
    order by g.generated_at desc
    limit 1;

    if v_paper_id is null then
      v_report := v_report || jsonb_build_object('roll_no', v_roll, 'name', v_name, 'status', 'set_not_found', 'set_code', v_set);
      continue;
    end if;

    if exists (select 1 from public.omr_responses
               where paper_base_serial = p_paper_base_serial and student_id = v_student) then
      v_report := v_report || jsonb_build_object('roll_no', v_roll, 'name', v_name, 'status', 'already_imported');
      continue;
    end if;

    v_n := jsonb_array_length(v_keys);
    v_qcount := greatest(v_qcount, v_n);
    v_wrong := 0; v_right := 0; v_skipped := 0;

    for i in 1..v_n loop
      select nullif(x->>'Question ID','')::uuid, upper(trim(coalesce(x->>'Correct Option','')))
        into v_qid, v_key
      from jsonb_array_elements(v_keys) x
      where (x->>'Q.No.')::int = i
      limit 1;
      if v_qid is null and v_key is null then continue; end if;

      v_sel_raw  := trim(coalesce(r->'answers'->>(i-1), ''));
      v_sel      := upper(v_sel_raw);
      v_sheet_key := upper(trim(coalesce(r->'sheet_keys'->>(i-1), '')));

      if v_sheet_key <> '' and v_sheet_key <> v_key then
        v_skipped := v_skipped + 1;
        if not (v_skipped_all @> to_jsonb(v_set || '-' || i)) then
          v_skipped_all := v_skipped_all || to_jsonb(v_set || '-' || i);
        end if;
        continue;
      end if;

      -- Only a single A–D mark equal to the key is correct.
      -- Blank, multiple marks ("A, C") or wrong = mistake.
      v_ok := v_sel ~ '^[ABCD]$' and v_sel = v_key;
      if v_ok then v_right := v_right + 1; else v_wrong := v_wrong + 1; end if;

      if not p_dry_run then
        insert into public.omr_responses(import_id, paper_base_serial, student_id, set_code, question_no,
                                         mock_question_id, selected_option, correct_option, is_correct)
        values (v_import, p_paper_base_serial, v_student, v_set, i, v_qid, nullif(v_sel_raw,''), v_key, v_ok)
        on conflict (paper_base_serial, student_id, question_no) do nothing;
        perform public.v14_apply_question_result(v_student, v_qid, v_ok, 'OMR');
      end if;
    end loop;

    v_imported := v_imported + 1;
    v_report := v_report || jsonb_build_object('roll_no', v_roll, 'name', v_name, 'status', 'ok',
                  'set_code', v_set, 'correct', v_right, 'mistakes', v_wrong, 'skipped', v_skipped);
  end loop;

  if not p_dry_run then
    update public.omr_imports
       set student_count = v_imported, question_count = v_qcount, skipped_questions = v_skipped_all
     where id = v_import;
  end if;

  return jsonb_build_object('dry_run', p_dry_run, 'import_id', v_import, 'imported', v_imported,
                            'skipped_questions', v_skipped_all, 'rows', v_report);
end;
$$;
revoke all on function public.teacher_import_omr_results(text, text, text, jsonb, boolean) from public;
grant execute on function public.teacher_import_omr_results(text, text, text, jsonb, boolean) to authenticated;

select 'V14 OMR + mistakes migration complete' as status;
