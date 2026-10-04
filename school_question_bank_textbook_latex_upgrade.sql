-- School Question Bank: textbook source + Excel LaTeX support
-- Run once in Supabase SQL Editor after the existing School Question Bank migrations.

alter table public.school_question_bank_questions
  add column if not exists text_book boolean not null default false;

alter table public.school_question_bank_questions
  add column if not exists textbook_reference text;

create index if not exists idx_school_question_bank_questions_text_book
  on public.school_question_bank_questions(teacher_id, text_book);

create index if not exists idx_school_question_bank_questions_textbook_reference
  on public.school_question_bank_questions(teacher_id, textbook_reference);
