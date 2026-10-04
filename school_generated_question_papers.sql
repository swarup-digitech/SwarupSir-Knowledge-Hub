-- SCHOOL COURSE ONLY
-- Generated Question Paper History for School Course.
-- This migration does not alter any JNVST table.

create extension if not exists pgcrypto;

create table if not exists public.school_generated_question_papers (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null,
  course_type text not null default 'SCHOOL',
  title text not null default 'School Question Paper',
  subject text,
  class_name text,
  medium text not null default 'EN',
  total_questions integer not null default 0,
  total_marks numeric not null default 0,
  question_ids jsonb not null default '[]'::jsonb,
  paper_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint school_generated_question_papers_course_check check (course_type = 'SCHOOL')
);

create index if not exists idx_school_generated_question_papers_teacher
  on public.school_generated_question_papers(teacher_id, created_at desc);

create index if not exists idx_school_generated_question_papers_course
  on public.school_generated_question_papers(course_type);

alter table public.school_generated_question_papers enable row level security;

drop policy if exists "school_generated_papers_select_own" on public.school_generated_question_papers;
drop policy if exists "school_generated_papers_insert_own" on public.school_generated_question_papers;
drop policy if exists "school_generated_papers_update_own" on public.school_generated_question_papers;
drop policy if exists "school_generated_papers_delete_own" on public.school_generated_question_papers;

create policy "school_generated_papers_select_own"
on public.school_generated_question_papers
for select to authenticated
using (teacher_id = auth.uid() and course_type = 'SCHOOL');

create policy "school_generated_papers_insert_own"
on public.school_generated_question_papers
for insert to authenticated
with check (teacher_id = auth.uid() and course_type = 'SCHOOL');

create policy "school_generated_papers_update_own"
on public.school_generated_question_papers
for update to authenticated
using (teacher_id = auth.uid() and course_type = 'SCHOOL')
with check (teacher_id = auth.uid() and course_type = 'SCHOOL');

create policy "school_generated_papers_delete_own"
on public.school_generated_question_papers
for delete to authenticated
using (teacher_id = auth.uid() and course_type = 'SCHOOL');

-- Keep updated_at current when an existing history record is edited.
create or replace function public.set_school_generated_question_papers_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_school_generated_question_papers_updated_at
on public.school_generated_question_papers;

create trigger trg_school_generated_question_papers_updated_at
before update on public.school_generated_question_papers
for each row execute function public.set_school_generated_question_papers_updated_at();

-- Verify only the School history table was created/updated:
-- select count(*) from public.school_generated_question_papers;
