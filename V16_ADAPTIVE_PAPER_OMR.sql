-- =============================================================================
-- V16 — Custom Adaptive Question Papers: OMR import support
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor (after V14_OMR_MISTAKES_MIGRATION.sql and
-- V14_FIX_LAST_RESULT_CHECK.sql). Safe to re-run. It changes no data.
--
-- A personal paper is saved as serial QSET-…-P01, -P02 … (one per student) and its
-- paper_snapshot holds the student_id. The OMR import now:
--   * finds every paper of the batch (serial suffix may be longer than one letter), and
--   * picks the student's own paper by student_id; normal A–D papers behave exactly as before.
-- =============================================================================

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
                   and (serial_no = p_paper_base_serial or serial_no like p_paper_base_serial || '-%')) then
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
      and (g.serial_no = p_paper_base_serial or g.serial_no like p_paper_base_serial || '-%')
      and (
            -- personal (Custom Adaptive) paper: found by the student, whatever the set column says
            g.paper_snapshot->>'student_id' = v_student::text
         or (coalesce(g.paper_snapshot->>'student_id','') = '' and upper(coalesce(g.set_code,'A')) = v_set)
          )
    order by (g.paper_snapshot->>'student_id' = v_student::text) desc nulls last, g.generated_at desc
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

select 'V16 adaptive paper OMR support applied' as status;
