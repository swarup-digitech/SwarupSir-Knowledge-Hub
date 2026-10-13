-- =============================================================================
-- V18 — Student OMR result reports with subject / lesson grouping (replaces the V17 functions)
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor (after V14 and V16 files). Safe to re-run.
-- Adds two functions the student app uses to show and download the student's OWN
-- result report. A student can only ever read their own rows.
--   student_omr_exams()                 -> list of the student's scanned exams with score
--   student_omr_report(p_base_serial)   -> one exam: every question, the student's answer,
--                                          the correct answer and the question content
-- =============================================================================

create or replace function public.student_omr_exams()
returns table(paper_base_serial text, title text, subject text, total integer, correct integer, imported_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select r.paper_base_serial,
         coalesce((select g.title from public.jnvst_generated_question_papers g
                   where g.serial_no = r.paper_base_serial or g.serial_no like r.paper_base_serial || '-%'
                   order by g.generated_at limit 1), max(i.exam_title), 'OMR exam') as title,
         (select g.subject from public.jnvst_generated_question_papers g
           where g.serial_no = r.paper_base_serial or g.serial_no like r.paper_base_serial || '-%'
           order by g.generated_at limit 1) as subject,
         count(*)::int as total,
         (count(*) filter (where r.is_correct))::int as correct,
         max(i.imported_at) as imported_at
  from public.omr_responses r
  join public.omr_imports i on i.id = r.import_id
  where r.student_id = auth.uid()
  group by r.paper_base_serial
  order by max(i.imported_at) desc;
$$;
revoke all on function public.student_omr_exams() from public, anon;
grant execute on function public.student_omr_exams() to authenticated;

create or replace function public.student_omr_report(p_paper_base_serial text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g record;
  v_set text;
  v_rows jsonb;
begin
  if v_uid is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  select upper(set_code) into v_set from public.omr_responses
   where student_id = v_uid and paper_base_serial = p_paper_base_serial limit 1;
  if v_set is null then raise exception 'No OMR result found for this exam.'; end if;

  select * into g from public.jnvst_generated_question_papers p
   where (p.serial_no = p_paper_base_serial or p.serial_no like p_paper_base_serial || '-%')
     and (p.paper_snapshot->>'student_id' = v_uid::text
          or (coalesce(p.paper_snapshot->>'student_id','') = '' and upper(coalesce(p.set_code,'A')) = v_set))
   order by (p.paper_snapshot->>'student_id' = v_uid::text) desc nulls last, p.generated_at desc
   limit 1;
  if not found then raise exception 'The question paper for this result was not found.'; end if;

  select jsonb_agg(jsonb_build_object(
           'no', r.question_no,
           'selected', coalesce(r.selected_option, ''),
           'correct_option', r.correct_option,
           'is_correct', r.is_correct,
           'q', (select jsonb_build_object(
                   'question_text', x->>'question_text', 'option_a', x->>'option_a', 'option_b', x->>'option_b',
                   'option_c', x->>'option_c', 'option_d', x->>'option_d', 'image_url', x->>'image_url',
                   'explanation', x->>'explanation', 'topic', x->>'topic', '_partHeading', x->>'_partHeading', '_passageTitle', x->>'_passageTitle',
                   'subject_name', (select sj.name from public.jnvst_subjects sj where sj.id::text = x->>'subject_id' limit 1),
                   'lesson_name', (select coalesce(pl.lesson_name || ' › ', '') || l.lesson_name
                                     from public.jnvst_subject_lessons l
                                     left join public.jnvst_subject_lessons pl on pl.id = l.parent_lesson_id
                                    where l.id::text = x->>'lesson_id' limit 1))
                 from jsonb_array_elements(g.paper_snapshot->'rows') with ordinality t(x, n)
                 where n = r.question_no)
         ) order by r.question_no)
    into v_rows
  from public.omr_responses r
  where r.student_id = v_uid and r.paper_base_serial = p_paper_base_serial;

  return jsonb_build_object(
    'title', g.title, 'subject', g.subject, 'generated_at', g.generated_at,
    'student_name', (select full_name from public.profiles where id = v_uid),
    'roll_no', (select roll_no from public.profiles where id = v_uid),
    'imported_at', (select max(i.imported_at) from public.omr_imports i
                    join public.omr_responses r2 on r2.import_id = i.id
                    where r2.student_id = v_uid and r2.paper_base_serial = p_paper_base_serial),
    'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;
revoke all on function public.student_omr_report(text) from public, anon;
grant execute on function public.student_omr_report(text) to authenticated;

select 'V18 student OMR report grouping applied' as status;
