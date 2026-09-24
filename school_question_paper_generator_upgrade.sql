-- School Course Question Paper Generator Upgrade
-- Run after school_question_bank_migration.sql and school_question_bank_bulk_upgrade.sql
-- Adds support for variation groups, persistent Fixed Questions, and chapter-wise
-- marks range generation controls. Chapter marks ranges are entered per paper
-- (including Excel bulk upload) and do not need permanent storage.

alter table public.school_question_bank_questions
  add column if not exists variation_group text;

create index if not exists idx_school_question_bank_questions_variation_group
  on public.school_question_bank_questions(teacher_id, variation_group);


alter table public.school_question_bank_questions
  add column if not exists is_fixed boolean not null default false;

create index if not exists idx_school_question_bank_questions_fixed
  on public.school_question_bank_questions(teacher_id, is_fixed);
