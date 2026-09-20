-- Mock Test passage display repair
-- Run once in Supabase SQL Editor.
-- Repairs existing generated Mock Test questions whose passage_text was not copied.

update public.mock_test_questions mtq
set passage_text = coalesce(
  nullif(trim(b.passage_text), ''),
  (
    select b2.passage_text
    from public.mock_question_bank b2
    where b2.passage_id = b.passage_id
      and nullif(trim(b2.passage_text), '') is not null
    order by b2.question_order nulls last, b2.created_at
    limit 1
  )
)
from public.mock_question_bank b
where mtq.bank_question_id = b.id
  and mtq.part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE')
  and nullif(trim(mtq.passage_text), '') is null
  and (
    nullif(trim(b.passage_text), '') is not null
    or exists (
      select 1
      from public.mock_question_bank b2
      where b2.passage_id = b.passage_id
        and nullif(trim(b2.passage_text), '') is not null
    )
  );

-- Verify repaired rows:
select mtq.id, mtq.mock_test_id, mtq.question_number, mtq.part_code,
       left(mtq.passage_text, 120) as passage_preview
from public.mock_test_questions mtq
where mtq.part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE')
order by mtq.mock_test_id, mtq.question_number;
