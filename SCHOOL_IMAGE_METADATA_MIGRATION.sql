-- School Course only: image requirement metadata for Question Bank questions
alter table public.school_question_bank_questions
  add column if not exists image_required boolean not null default false,
  add column if not exists image_description text;

create index if not exists idx_school_qb_image_required
  on public.school_question_bank_questions(teacher_id, course_type, image_required);

-- Existing questions that already contain an uploaded image block are marked as having an image.
update public.school_question_bank_questions q
set image_required = true
where q.course_type = 'SCHOOL'
  and exists (
    select 1 from public.school_question_bank_blocks b
    where b.question_id = q.id and b.block_type = 'IMAGE'
  );
