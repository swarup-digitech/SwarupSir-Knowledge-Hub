-- V47: after the teacher releases the result, the student's result page can show every question with the options,
-- the correct answer and the explanation (taken from the question bank). Safe to re-run.
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
  v_lang text;
begin
  select a.mock_test_id, coalesce((to_jsonb(t)->>'results_released')::boolean, false), upper(coalesce(to_jsonb(t)->>'language',''))
    into v_test, v_released, v_lang
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
             'marks', q.marks,
             'question_text', q.question_text,
             'option_a', q.option_a,
             'option_b', q.option_b,
             'option_c', q.option_c,
             'option_d', q.option_d,
             'image_url', q.image_url,
             'passage_title', to_jsonb(q)->>'passage_title',
             'passage_text', q.passage_text,
             'explanation',
               case when v_lang = 'ASSAMESE'
                    then coalesce(nullif(to_jsonb(b)->>'explanation_as',''), nullif(to_jsonb(b)->>'explanation',''))
                    else nullif(to_jsonb(b)->>'explanation','') end
           ) order by q.question_number)
    from public.mock_test_questions q
    left join public.mock_question_bank b on b.id = q.bank_question_id
    where q.mock_test_id = v_test
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.student_mock_result_questions(uuid) from public;
grant execute on function public.student_mock_result_questions(uuid) to authenticated;
