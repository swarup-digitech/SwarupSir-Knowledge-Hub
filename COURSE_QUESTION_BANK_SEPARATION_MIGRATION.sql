-- Swarup Sir's Knowledge Hub
-- Separate JNVST and School Course question-bank data.
-- Run once in Supabase SQL Editor after the existing question-bank migrations.

-- 1) Explicit course discriminator.
alter table public.school_question_bank_questions
  add column if not exists course_type text not null default 'SCHOOL';

alter table public.school_question_bank_questions
  drop constraint if exists school_question_bank_questions_course_type_check;

alter table public.school_question_bank_questions
  add constraint school_question_bank_questions_course_type_check
  check (course_type in ('JNVST','SCHOOL'));

-- 2) JNVST questions are the questions that were already assigned a JNVST subject/lesson.
--    Everything else remains School Course.
update public.school_question_bank_questions
set course_type='JNVST'
where jnvst_subject_id is not null or jnvst_lesson_id is not null;

update public.school_question_bank_questions
set course_type='SCHOOL'
where course_type is null;

create index if not exists idx_qb_questions_teacher_course
  on public.school_question_bank_questions(teacher_id, course_type, created_at desc);

create index if not exists idx_qb_questions_jnvst_filter
  on public.school_question_bank_questions(teacher_id, course_type, jnvst_subject_id, jnvst_lesson_id, medium);

-- 3) JNVST questions do not require the School Course chapter hierarchy.
--    School Course questions continue to require chapter_id in the application.
alter table public.school_question_bank_questions
  alter column chapter_id drop not null;

-- 4) Keep the existing JNVST Subject -> Lesson -> Sub-lesson catalogue separate.
--    Existing Chapter/Subchapter/Topic data is not deleted or altered.

select 'JNVST and School Course Question Banks are now logically separated by course_type.' as status;
