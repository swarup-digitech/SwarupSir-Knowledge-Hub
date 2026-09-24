-- School Course Question Paper Generator Upgrade
-- Run after school_question_bank_migration.sql and school_question_bank_bulk_upgrade.sql
-- Adds support for variation groups. Fixed questions and chapter marks ranges are
-- selected per paper in the Teacher Dashboard and do not need permanent storage.

alter table public.school_question_bank_questions
  add column if not exists variation_group text;

create index if not exists idx_school_question_bank_questions_variation_group
  on public.school_question_bank_questions(teacher_id, variation_group);
