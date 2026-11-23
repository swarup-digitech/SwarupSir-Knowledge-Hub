-- V48: Pen-paper (OMR) Mock Tests also get a normal result for every student.
-- Importing the OMR file now also creates a submitted attempt + answers, links the student to the test,
-- so the student's Mock Tests page shows the score card, "Review your answers" (V47) and the PDF result sheet
-- once the teacher presses "Approve Results" on that set. Bonus / changed-key questions are left out of the score.
-- Run V47 first. Safe to re-run. Students imported earlier keep only their Mistake Bank entries (re-import is skipped as 'already_imported').
alter table public.mock_test_attempts add column if not exists source text not null default 'ONLINE';

create or replace function public.teacher_import_mock_omr_results(
  p_series_group uuid,
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
  v_serial text := 'MOCK-' || p_series_group::text;
  v_import uuid;
  r jsonb;
  v_roll text; v_set text; v_lang text;
  v_student uuid; v_name text;
  v_test uuid;
  v_tests int;
  v_n int; i int;
  v_sel text; v_sel_raw text; v_sheet_key text; v_key text; v_qid uuid; v_ok boolean;
  v_report jsonb := '[]'::jsonb;
  v_imported int := 0; v_wrong int; v_right int; v_skipped int;
  v_skipped_all jsonb := '[]'::jsonb;
  v_qcount int := 0;
  v_att uuid; v_tq uuid; v_secname text; v_score numeric; v_pct numeric; v_sec jsonb; v_cnt int; v_marks numeric;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and lower(coalesce(role,'')) = 'teacher') then
    raise exception 'Only teachers can import OMR results.' using errcode = '42501';
  end if;

  select count(*) into v_tests from public.mock_tests t
   where t.teacher_id = v_uid and coalesce(t.series_group_id, t.id) = p_series_group;
  if v_tests = 0 then
    raise exception 'Mock Test was not found in your Mock Tests.';
  end if;

  if not p_dry_run then
    insert into public.omr_imports(teacher_id, paper_base_serial, exam_title, file_name)
    values (v_uid, v_serial, nullif(trim(p_exam_title),''), nullif(trim(p_file_name),''))
    returning id into v_import;
  end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    v_roll := trim(coalesce(r->>'roll_no', ''));
    v_set  := upper(trim(coalesce(r->>'set_code', '')));
    v_lang := upper(trim(coalesce(r->>'language', '')));   -- V40: ENGLISH / ASSAMESE booklet the student wrote
    v_student := null; v_test := null;

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

    select t.id into v_test
    from public.mock_tests t
    where t.teacher_id = v_uid and coalesce(t.series_group_id, t.id) = p_series_group
      and (v_tests = 1 or upper(coalesce(t.series_code,'')) = v_set)
    order by (case when v_lang <> '' and upper(coalesce(t.language,'')) = v_lang then 0 else 1 end), t.created_at
    limit 1;

    if v_test is null then
      v_report := v_report || jsonb_build_object('roll_no', v_roll, 'name', v_name, 'status', 'set_not_found', 'set_code', v_set);
      continue;
    end if;

    if exists (select 1 from public.omr_responses where paper_base_serial = v_serial and student_id = v_student) then
      v_report := v_report || jsonb_build_object('roll_no', v_roll, 'name', v_name, 'status', 'already_imported');
      continue;
    end if;

    select coalesce(max(question_number), 0) into v_n from public.mock_test_questions where mock_test_id = v_test;
    v_qcount := greatest(v_qcount, v_n);
    v_wrong := 0; v_right := 0; v_skipped := 0;
    v_att := null; v_score := 0; v_sec := '{}'::jsonb;
    if not p_dry_run then
      insert into public.mock_test_students(mock_test_id, student_id) values (v_test, v_student) on conflict do nothing;
      insert into public.mock_test_attempts(mock_test_id, student_id, start_at, end_at, submitted_at, status, total_questions, total_marks, source)
      select v_test, v_student, now(), now(), now(), 'submitted', v_n, coalesce(nullif(t.total_marks,0),100), 'OMR' from (select 100::numeric as total_marks) t
      returning id into v_att;
    end if;

    for i in 1..v_n loop
      v_qid := null; v_key := null;
      select q.bank_question_id, upper(trim(coalesce(q.correct_option,'')))
        into v_qid, v_key
      from public.mock_test_questions q
      where q.mock_test_id = v_test and q.question_number = i
      limit 1;
      if v_qid is null and coalesce(v_key,'') = '' then continue; end if;

      v_sel_raw   := trim(coalesce(r->'answers'->>(i-1), ''));
      v_sel       := upper(v_sel_raw);
      v_sheet_key := upper(trim(coalesce(r->'sheet_keys'->>(i-1), '')));

      if v_sheet_key <> '' and v_sheet_key <> v_key then
        v_skipped := v_skipped + 1;
        if not (v_skipped_all @> to_jsonb(v_set || '-' || i)) then
          v_skipped_all := v_skipped_all || to_jsonb(v_set || '-' || i);
        end if;
        continue;
      end if;

      v_ok := v_sel ~ '^[ABCD]$' and v_sel = v_key;
      if v_ok then v_right := v_right + 1; else v_wrong := v_wrong + 1; end if;

      if not p_dry_run then
        insert into public.omr_responses(import_id, paper_base_serial, student_id, set_code, question_no,
                                         mock_question_id, selected_option, correct_option, is_correct)
        values (v_import, v_serial, v_student, v_set, i, v_qid, nullif(v_sel_raw,''), v_key, v_ok)
        on conflict (paper_base_serial, student_id, question_no) do nothing;
        if v_qid is not null then
          perform public.v14_apply_question_result(v_student, v_qid, v_ok, 'OMR');
        end if;
        select q.id, coalesce(q.marks,1.25), q.section_code into v_tq, v_marks, v_secname
          from public.mock_test_questions q where q.mock_test_id = v_test and q.question_number = i limit 1;
        if v_sel ~ '^[ABCD]$' and v_tq is not null then
          insert into public.mock_test_answers(attempt_id, question_id, selected_option) values (v_att, v_tq, v_sel)
          on conflict do nothing;
        end if;
        if v_ok then v_score := v_score + v_marks; end if;
        v_sec := jsonb_set(v_sec, array[v_secname], jsonb_build_object(
                   'questions', coalesce((v_sec->v_secname->>'questions')::int,0) + 1,
                   'correct',   coalesce((v_sec->v_secname->>'correct')::int,0) + (case when v_ok then 1 else 0 end),
                   'marks',     coalesce((v_sec->v_secname->>'marks')::numeric,0) + (case when v_ok then v_marks else 0 end)), true);
      end if;
    end loop;

    if not p_dry_run and v_att is not null then
      update public.mock_test_attempts set score = round(v_score,2), percentage = round(v_score,2), section_results = v_sec where id = v_att;
    end if;
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
revoke all on function public.teacher_import_mock_omr_results(uuid, text, text, jsonb, boolean) from public;
grant execute on function public.teacher_import_mock_omr_results(uuid, text, text, jsonb, boolean) to authenticated;


select 'V48 paper mock results applied' as status;
