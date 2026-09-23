-- Run once after school_question_bank_migration.sql
alter table public.school_question_bank_questions
  add column if not exists correct_answer text;

create index if not exists idx_school_question_bank_questions_correct_answer
  on public.school_question_bank_questions(correct_answer);
