-- =============================================================================
-- V19 — "Common" label for JNVST questions (frequently asked in exams)
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor. Safe to re-run.
-- Adds one column to the JNVST/Mock question bank:
--   is_common  true  = you marked this question as Common (frequently asked)
--              false = normal question (default for every existing question)
-- Questions that share a Variation Group with a Common question are treated as
-- Common by the app automatically, so nothing else is stored.
-- =============================================================================
alter table public.mock_question_bank
  add column if not exists is_common boolean not null default false;

create index if not exists mock_question_bank_common_idx
  on public.mock_question_bank (teacher_id, is_common) where is_common;

-- check:  select count(*) filter (where is_common) as common_marked, count(*) as total from public.mock_question_bank;
