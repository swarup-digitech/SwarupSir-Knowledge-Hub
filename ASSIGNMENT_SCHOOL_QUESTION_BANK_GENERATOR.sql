-- Version 32: School Question Bank -> New Assignment Generator
-- PostgreSQL / Supabase SQL migration.
-- Run this file in Supabase SQL Editor.

alter table public.school_question_bank_questions
  add column if not exists topic text;
alter table public.school_question_bank_questions
  add column if not exists subject text;
alter table public.school_question_bank_questions
  add column if not exists medium text;

create index if not exists idx_school_question_bank_questions_topic
  on public.school_question_bank_questions(teacher_id, topic);
create index if not exists idx_school_question_bank_questions_subject_medium
  on public.school_question_bank_questions(teacher_id, subject, medium);

alter table public.questions
  add column if not exists source_school_question_bank_id uuid;
alter table public.questions
  add column if not exists source_variation_group text;
alter table public.questions
  add column if not exists source_chapter_id uuid;
alter table public.questions
  add column if not exists source_topic text;

do $$
begin
  if to_regclass('public.school_question_bank_questions') is not null then
    begin
      alter table public.questions
        add constraint questions_source_school_qb_fkey
        foreign key (source_school_question_bank_id)
        references public.school_question_bank_questions(id)
        on delete set null;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists idx_questions_source_school_qb
  on public.questions(source_school_question_bank_id);
create index if not exists idx_questions_source_variation_group
  on public.questions(source_variation_group);

select 'School Question Bank assignment generator migration complete' as status;
