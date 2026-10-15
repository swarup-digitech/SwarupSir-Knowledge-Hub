-- =============================================================================
-- V24 — Claude finds English/Assamese question pairs and translates missing ones
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor (after V23). Safe to re-run. Changes no existing data.
--
-- 1. mock_question_bank.translation_status
--      AUTO     = question written by Claude (auto-translated), not checked yet
--      CHECKED  = you checked it (set by "Mark checked", or automatically when you edit
--                 the question text or options of an AUTO question)
--      empty    = your own question (normal)
-- 2. jnvst_pair_checks: what Claude found for each unlinked question
--      PENDING     Claude suggests a partner — waiting for your approval
--      APPROVED    you approved, the two are linked
--      REJECTED    you said "not the same" — Claude will not suggest that partner again
--      NO_MATCH    no partner exists → can be translated
--      MANUAL      the question text is inside a picture → type the other version yourself
--      TRANSLATED  Claude wrote the missing version (it is linked)
--      FAILED      translation failed (error in "error"); press Translate again to retry
-- =============================================================================

alter table public.mock_question_bank add column if not exists translation_status text;
do $$ begin
  alter table public.mock_question_bank
    add constraint mock_qb_translation_status_chk
    check (translation_status is null or translation_status in ('AUTO','CHECKED'));
exception when duplicate_object then null; end $$;

create index if not exists idx_mock_qb_translation_auto
  on public.mock_question_bank(teacher_id) where translation_status = 'AUTO';

-- Editing the text or options of an auto-translated question counts as checking it.
create or replace function public.mock_qb_translation_checked_trg()
returns trigger language plpgsql as $$
begin
  if old.translation_status = 'AUTO'
     and new.translation_status is not distinct from old.translation_status
     and (new.question_text is distinct from old.question_text
          or new.option_a is distinct from old.option_a or new.option_b is distinct from old.option_b
          or new.option_c is distinct from old.option_c or new.option_d is distinct from old.option_d
          or new.passage_text is distinct from old.passage_text or new.passage_title is distinct from old.passage_title) then
    new.translation_status := 'CHECKED';
  end if;
  return new;
end $$;
drop trigger if exists mock_qb_translation_checked on public.mock_question_bank;
create trigger mock_qb_translation_checked
  before update on public.mock_question_bank
  for each row execute function public.mock_qb_translation_checked_trg();

create table if not exists public.jnvst_pair_checks (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null,
  subject_id   uuid,
  source_id    uuid not null,           -- the unlinked question
  candidate_id uuid,                    -- Claude's suggested partner (PENDING / APPROVED / REJECTED)
  group_key    text,                    -- passages: all 5 rows of one passage share this key
  status       text not null check (status in ('PENDING','APPROVED','REJECTED','NO_MATCH','MANUAL','TRANSLATED','FAILED')),
  confidence   text check (confidence is null or confidence in ('strong','weak')),
  reason       text,
  error        text,
  created_id   uuid,                    -- TRANSLATED: the new question Claude wrote
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_pair_checks_teacher_subject on public.jnvst_pair_checks(teacher_id, subject_id, status);
create index if not exists idx_pair_checks_source on public.jnvst_pair_checks(teacher_id, source_id);

alter table public.jnvst_pair_checks enable row level security;
drop policy if exists pair_checks_teacher_select on public.jnvst_pair_checks;
drop policy if exists pair_checks_teacher_update on public.jnvst_pair_checks;
drop policy if exists pair_checks_teacher_delete on public.jnvst_pair_checks;
create policy pair_checks_teacher_select on public.jnvst_pair_checks for select to authenticated
  using (teacher_id = (select auth.uid()));
create policy pair_checks_teacher_update on public.jnvst_pair_checks for update to authenticated
  using (teacher_id = (select auth.uid())) with check (teacher_id = (select auth.uid()));
create policy pair_checks_teacher_delete on public.jnvst_pair_checks for delete to authenticated
  using (teacher_id = (select auth.uid()));
-- rows are written by the pair-questions Edge Function (service role)

-- check: select status, count(*) from public.jnvst_pair_checks group by 1;
