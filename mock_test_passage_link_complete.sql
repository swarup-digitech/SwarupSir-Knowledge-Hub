-- Mock Test passage linkage: complete EVS + Language implementation
-- Run once in Supabase SQL Editor after the existing Mock Test migrations.
-- Safe to re-run. Existing Mock Tests are repaired in-place; they are not regenerated.

alter table public.mock_question_bank add column if not exists passage_id text;
alter table public.mock_question_bank add column if not exists passage_title text;
alter table public.mock_question_bank add column if not exists question_order integer;

alter table public.mock_test_questions add column if not exists passage_id text;
alter table public.mock_test_questions add column if not exists passage_title text;
alter table public.mock_test_questions add column if not exists passage_text text;

create index if not exists idx_mock_bank_teacher_part_passage_order
  on public.mock_question_bank(teacher_id, part_code, language, passage_id, question_order);

create index if not exists idx_mock_test_questions_test_passage
  on public.mock_test_questions(mock_test_id, passage_id, question_number);

-- Backfill missing passage metadata in the bank from another question in the same passage group.
update public.mock_question_bank q
set passage_title = coalesce(nullif(trim(q.passage_title), ''), src.passage_title),
    passage_text  = coalesce(nullif(trim(q.passage_text), ''), src.passage_text)
from lateral (
  select b.passage_title, b.passage_text
  from public.mock_question_bank b
  where b.teacher_id = q.teacher_id
    and b.part_code = q.part_code
    and b.language = q.language
    and b.passage_id = q.passage_id
    and (nullif(trim(b.passage_title), '') is not null or nullif(trim(b.passage_text), '') is not null)
  order by
    (nullif(trim(b.passage_title), '') is not null) desc,
    (nullif(trim(b.passage_text), '') is not null) desc,
    b.question_order nulls last, b.created_at
  limit 1
) src
where q.part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE')
  and q.passage_id is not null
  and (nullif(trim(q.passage_title), '') is null or nullif(trim(q.passage_text), '') is null);

-- Snapshot passage metadata into existing generated Mock Test questions.
update public.mock_test_questions mtq
set passage_id = coalesce(mtq.passage_id, b.passage_id, peer.passage_id),
    passage_title = coalesce(nullif(trim(mtq.passage_title), ''), nullif(trim(b.passage_title), ''), nullif(trim(peer.passage_title), '')),
    passage_text = coalesce(nullif(trim(mtq.passage_text), ''), nullif(trim(b.passage_text), ''), nullif(trim(peer.passage_text), ''))
from public.mock_question_bank b
left join lateral (
  select b2.passage_id, b2.passage_title, b2.passage_text
  from public.mock_question_bank b2
  where b2.teacher_id = b.teacher_id
    and b2.part_code = b.part_code
    and b2.language = b.language
    and b2.passage_id = b.passage_id
    and (nullif(trim(b2.passage_title), '') is not null or nullif(trim(b2.passage_text), '') is not null)
  order by (nullif(trim(b2.passage_title), '') is not null) desc, (nullif(trim(b2.passage_text), '') is not null) desc, b2.question_order nulls last, b2.created_at
  limit 1
) peer on true
where mtq.bank_question_id = b.id
  and mtq.part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE');

-- Normalize all five questions in each generated passage group to the same snapshot metadata.
update public.mock_test_questions mtq
set passage_id = grp.passage_id,
    passage_title = grp.passage_title,
    passage_text = grp.passage_text
from (
  select mock_test_id, part_code, passage_id,
         max(nullif(trim(passage_title), '')) as passage_title,
         max(nullif(trim(passage_text), '')) as passage_text
  from public.mock_test_questions
  where part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE')
    and passage_id is not null
  group by mock_test_id, part_code, passage_id
) grp
where mtq.mock_test_id = grp.mock_test_id
  and mtq.part_code = grp.part_code
  and mtq.passage_id = grp.passage_id;

-- Verification report: every passage group should have exactly 5 questions and complete metadata.
select mock_test_id, part_code, passage_id, count(*) as question_count,
       bool_and(nullif(trim(passage_title), '') is not null) as has_title,
       bool_and(nullif(trim(passage_text), '') is not null) as has_complete_passage
from public.mock_test_questions
where part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE')
group by mock_test_id, part_code, passage_id
order by mock_test_id, part_code, passage_id;
