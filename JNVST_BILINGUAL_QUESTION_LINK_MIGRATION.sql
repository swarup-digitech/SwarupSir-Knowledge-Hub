-- JNVST bilingual question linkage
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.mock_question_bank
  add column if not exists language_pair_id uuid;

create index if not exists idx_mock_bank_language_pair
  on public.mock_question_bank(language_pair_id);

comment on column public.mock_question_bank.language_pair_id is
  'Shared ID linking English and Assamese versions imported from the same JNVST Excel row. MAT common questions may also use this field.';
