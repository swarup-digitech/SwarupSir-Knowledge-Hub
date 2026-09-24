-- Run once after the existing Question Bank migrations.
-- Prevents the same bulk source/question from being imported again.
alter table public.school_question_bank_questions
  add column if not exists source_fingerprint text;

create unique index if not exists uq_school_question_bank_questions_teacher_source_fingerprint
  on public.school_question_bank_questions(teacher_id, source_fingerprint)
  where source_fingerprint is not null;

create index if not exists idx_school_question_bank_questions_source_fingerprint
  on public.school_question_bank_questions(source_fingerprint);
