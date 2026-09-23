-- Question Bank: Chapter / Subchapter hierarchy upgrade
-- Run once in Supabase SQL Editor AFTER school_question_bank_migration.sql

alter table public.school_question_bank_chapters
  add column if not exists chapter_code text,
  add column if not exists parent_chapter_id uuid references public.school_question_bank_chapters(id) on delete restrict;

update public.school_question_bank_chapters
set chapter_code = coalesce(nullif(chapter_code,''), chapter_number::text)
where chapter_code is null or chapter_code = '';

create index if not exists idx_qb_chapters_parent on public.school_question_bank_chapters(parent_chapter_id);
create index if not exists idx_qb_chapters_code on public.school_question_bank_chapters(teacher_id, chapter_code);

-- Helpful constraint: a chapter/subchapter cannot be its own parent.
alter table public.school_question_bank_chapters
  drop constraint if exists qb_chapter_not_self_parent;
alter table public.school_question_bank_chapters
  add constraint qb_chapter_not_self_parent check (parent_chapter_id is null or parent_chapter_id <> id);
