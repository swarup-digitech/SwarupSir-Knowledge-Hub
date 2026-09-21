-- Superseded by mock_test_passage_link_complete.sql
-- Use the complete migration for EVS + Language passage_id, passage_title and passage_text repair.
-- This file is retained for compatibility with older deployment notes.

update public.mock_test_questions mtq
set passage_text = coalesce(nullif(trim(mtq.passage_text), ''), nullif(trim(b.passage_text), '')),
    passage_title = coalesce(nullif(trim(mtq.passage_title), ''), nullif(trim(b.passage_title), '')),
    passage_id = coalesce(mtq.passage_id, b.passage_id)
from public.mock_question_bank b
where mtq.bank_question_id = b.id
  and mtq.part_code in ('EVS_PASSAGE','LANGUAGE_PASSAGE');
