-- School Question Bank + Paper Generator migration
-- Run once in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.school_question_bank_chapters (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  chapter_number integer not null default 1,
  chapter_name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.school_question_bank_questions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.school_question_bank_chapters(id) on delete restrict,
  question_text_en text,
  question_text_as text,
  question_type text not null check (question_type in ('MCQ','Short','Long')),
  marks integer not null check (marks > 0),
  cognitive_level text not null check (cognitive_level in ('Knowledge','Understanding','Application','HOTS')),
  difficulty text not null default 'Medium' check (difficulty in ('Easy','Medium','Hard')),
  variation_group text,
  explanation text,
  has_images boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.school_question_bank_blocks (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.school_question_bank_questions(id) on delete cascade,
  block_order integer not null,
  block_type text not null check (block_type in ('TEXT','IMAGE')),
  text_en text,
  text_as text,
  image_url text,
  image_width numeric not null default 70,
  alt_text text
);

create table if not exists public.school_question_bank_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.school_question_bank_questions(id) on delete cascade,
  display_order integer not null,
  option_label text not null,
  option_text_en text,
  option_text_as text,
  image_url text,
  is_correct boolean not null default false
);

create index if not exists idx_qb_questions_teacher on public.school_question_bank_questions(teacher_id);
create index if not exists idx_qb_questions_chapter on public.school_question_bank_questions(chapter_id);
create index if not exists idx_qb_blocks_question on public.school_question_bank_blocks(question_id,block_order);
create index if not exists idx_qb_options_question on public.school_question_bank_options(question_id,display_order);

-- Storage bucket for teacher question-bank images.
insert into storage.buckets(id,name,public)
values('school-question-bank-images','school-question-bank-images',true)
on conflict(id) do update set public=true;

create or replace function public.is_school_question_bank_teacher()
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.profiles where id=auth.uid() and role='teacher');
$$;

drop policy if exists "qb teacher upload" on storage.objects;
create policy "qb teacher upload" on storage.objects for insert to authenticated
with check(bucket_id='school-question-bank-images' and public.is_school_question_bank_teacher()
  and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "qb teacher delete" on storage.objects;
create policy "qb teacher delete" on storage.objects for delete to authenticated
using(bucket_id='school-question-bank-images' and public.is_school_question_bank_teacher()
  and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "qb public read" on storage.objects;
create policy "qb public read" on storage.objects for select to public
using(bucket_id='school-question-bank-images');

alter table public.school_question_bank_chapters enable row level security;
alter table public.school_question_bank_questions enable row level security;
alter table public.school_question_bank_blocks enable row level security;
alter table public.school_question_bank_options enable row level security;

drop policy if exists "qb chapters teacher select" on public.school_question_bank_chapters;
create policy "qb chapters teacher select" on public.school_question_bank_chapters for select to authenticated using(teacher_id=auth.uid());
drop policy if exists "qb chapters teacher insert" on public.school_question_bank_chapters;
create policy "qb chapters teacher insert" on public.school_question_bank_chapters for insert to authenticated with check(teacher_id=auth.uid());
drop policy if exists "qb chapters teacher update" on public.school_question_bank_chapters;
create policy "qb chapters teacher update" on public.school_question_bank_chapters for update to authenticated using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());
drop policy if exists "qb chapters teacher delete" on public.school_question_bank_chapters;
create policy "qb chapters teacher delete" on public.school_question_bank_chapters for delete to authenticated using(teacher_id=auth.uid());

drop policy if exists "qb questions teacher all" on public.school_question_bank_questions;
create policy "qb questions teacher all" on public.school_question_bank_questions for all to authenticated
using(teacher_id=auth.uid()) with check(teacher_id=auth.uid());

drop policy if exists "qb blocks teacher all" on public.school_question_bank_blocks;
create policy "qb blocks teacher all" on public.school_question_bank_blocks for all to authenticated
using(exists(select 1 from public.school_question_bank_questions q where q.id=question_id and q.teacher_id=auth.uid()))
with check(exists(select 1 from public.school_question_bank_questions q where q.id=question_id and q.teacher_id=auth.uid()));

drop policy if exists "qb options teacher all" on public.school_question_bank_options;
create policy "qb options teacher all" on public.school_question_bank_options for all to authenticated
using(exists(select 1 from public.school_question_bank_questions q where q.id=question_id and q.teacher_id=auth.uid()))
with check(exists(select 1 from public.school_question_bank_questions q where q.id=question_id and q.teacher_id=auth.uid()));
