-- Swarup Sir's Knowledge Hub — Mock Test module
-- Run this AFTER the existing assignment/retry SQL. Do not recreate the old one-submission index.

create table if not exists public.mock_question_bank (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  section_code text not null check (section_code in ('MAT','EVS','ARITHMETIC','LANGUAGE')),
  part_code text not null,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  passage_text text,
  image_url text,
  source_type text not null default 'excel' check (source_type in ('excel','pdf')),
  source_question_no integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  time_limit_seconds integer not null default 7200,
  total_questions integer not null default 80,
  total_marks numeric(8,2) not null default 100,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_at timestamptz not null default now()
);

create table if not exists public.mock_test_questions (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  bank_question_id uuid references public.mock_question_bank(id) on delete set null,
  question_number integer not null,
  section_code text not null,
  part_code text not null,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  passage_text text,
  image_url text,
  marks numeric(6,2) not null default 1.25,
  created_at timestamptz not null default now(),
  unique(mock_test_id, question_number)
);

create table if not exists public.mock_test_students (
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key(mock_test_id, student_id)
);

create table if not exists public.mock_test_attempts (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null default now(),
  end_at timestamptz not null,
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted')),
  total_questions integer not null default 80,
  total_marks numeric(8,2) not null default 100,
  score numeric(8,2) not null default 0,
  percentage numeric(8,2) not null default 0,
  section_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mock_test_attempts(id) on delete cascade,
  question_id uuid not null references public.mock_test_questions(id) on delete cascade,
  selected_option text not null check (selected_option in ('A','B','C','D')),
  answered_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create index if not exists idx_mock_bank_teacher_part on public.mock_question_bank(teacher_id,part_code,active);
-- Passage metadata used by EVS/Language Excel uploads. A passage is stored once logically
-- by Passage ID while its five linked questions carry the same passage_id.
alter table public.mock_question_bank add column if not exists passage_id text;
alter table public.mock_question_bank add column if not exists passage_title text;
alter table public.mock_question_bank add column if not exists question_order integer;
create index if not exists idx_mock_bank_teacher_passage on public.mock_question_bank(teacher_id,part_code,passage_id);

create index if not exists idx_mock_test_teacher on public.mock_tests(teacher_id,created_at desc);
create index if not exists idx_mock_test_students_student on public.mock_test_students(student_id,mock_test_id);
create index if not exists idx_mock_attempts_student_test on public.mock_test_attempts(student_id,mock_test_id,status);
create index if not exists idx_mock_answers_attempt on public.mock_test_answers(attempt_id);

alter table public.mock_question_bank enable row level security;
alter table public.mock_tests enable row level security;
alter table public.mock_test_questions enable row level security;
alter table public.mock_test_students enable row level security;
alter table public.mock_test_attempts enable row level security;
alter table public.mock_test_answers enable row level security;


-- Make the SQL safe to re-run.
-- SECURITY DEFINER helper functions prevent circular RLS evaluation between
-- mock_tests and mock_test_students (the source of
-- "infinite recursion detected in policy for relation mock_test_students").

drop function if exists public.is_mock_test_teacher(uuid);
drop function if exists public.is_mock_test_assigned(uuid);
drop function if exists public.is_mock_test_question_teacher(uuid);
drop function if exists public.is_mock_attempt_teacher(uuid);
drop function if exists public.is_mock_answer_teacher(uuid);

create or replace function public.is_mock_test_teacher(p_mock_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mock_tests t
    where t.id = p_mock_test_id
      and t.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_mock_test_assigned(p_mock_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mock_test_students s
    where s.mock_test_id = p_mock_test_id
      and s.student_id = auth.uid()
  );
$$;

create or replace function public.is_mock_test_question_teacher(p_question_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mock_test_questions q
    join public.mock_tests t on t.id = q.mock_test_id
    where q.id = p_question_id
      and t.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_mock_attempt_teacher(p_attempt_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mock_test_attempts a
    join public.mock_tests t on t.id = a.mock_test_id
    where a.id = p_attempt_id
      and t.teacher_id = auth.uid()
  );
$$;

create or replace function public.is_mock_answer_teacher(p_answer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.mock_test_answers ma
    join public.mock_test_attempts a on a.id = ma.attempt_id
    join public.mock_tests t on t.id = a.mock_test_id
    where ma.id = p_answer_id
      and t.teacher_id = auth.uid()
  );
$$;

-- Policies
drop policy if exists "mock bank teacher manage" on public.mock_question_bank;
drop policy if exists "mock tests teacher manage" on public.mock_tests;
drop policy if exists "mock test questions teacher manage" on public.mock_test_questions;
drop policy if exists "mock recipients teacher manage" on public.mock_test_students;
drop policy if exists "mock attempts teacher read" on public.mock_test_attempts;
drop policy if exists "mock answers teacher read" on public.mock_test_answers;
drop policy if exists "mock tests student assigned read" on public.mock_tests;
drop policy if exists "mock test questions student read" on public.mock_test_questions;
drop policy if exists "mock recipients student read own" on public.mock_test_students;
drop policy if exists "mock attempts student own" on public.mock_test_attempts;
drop policy if exists "mock answers student own" on public.mock_test_answers;
drop policy if exists "mock image teacher upload" on storage.objects;
drop policy if exists "mock image teacher delete" on storage.objects;

-- Teacher policies
create policy "mock bank teacher manage" on public.mock_question_bank
for all to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "mock tests teacher manage" on public.mock_tests
for all to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

create policy "mock test questions teacher manage" on public.mock_test_questions
for all to authenticated
using (public.is_mock_test_teacher(mock_test_id))
with check (public.is_mock_test_teacher(mock_test_id));

create policy "mock recipients teacher manage" on public.mock_test_students
for all to authenticated
using (public.is_mock_test_teacher(mock_test_id))
with check (public.is_mock_test_teacher(mock_test_id));

create policy "mock attempts teacher read" on public.mock_test_attempts
for select to authenticated
using (public.is_mock_test_teacher(mock_test_id));

create policy "mock answers teacher read" on public.mock_test_answers
for select to authenticated
using (public.is_mock_attempt_teacher(attempt_id));

-- Student policies. These use SECURITY DEFINER helpers so no policy recursively
-- queries a relation whose own RLS policy points back to the first relation.
create policy "mock tests student assigned read" on public.mock_tests
for select to authenticated
using (public.is_mock_test_assigned(id));

create policy "mock test questions student read" on public.mock_test_questions
for select to authenticated
using (public.is_mock_test_assigned(mock_test_id));

create policy "mock recipients student read own" on public.mock_test_students
for select to authenticated
using (student_id = auth.uid());

create policy "mock attempts student own" on public.mock_test_attempts
for all to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "mock answers student own" on public.mock_test_answers
for all to authenticated
using (exists (
  select 1 from public.mock_test_attempts a
  where a.id = attempt_id and a.student_id = auth.uid()
))
with check (exists (
  select 1 from public.mock_test_attempts a
  where a.id = attempt_id and a.student_id = auth.uid()
));

-- Public bucket for cropped question-page images.
insert into storage.buckets (id,name,public) values ('mock-question-images','mock-question-images',true)
on conflict (id) do update set public=true;

create policy "mock image teacher upload" on storage.objects for insert to authenticated
with check (bucket_id='mock-question-images' and (storage.foldername(name))[1]=auth.uid()::text);

create policy "mock image teacher delete" on storage.objects for delete to authenticated
using (bucket_id='mock-question-images' and (storage.foldername(name))[1]=auth.uid()::text);

-- Public read is provided by the public bucket. If you later make the bucket private,
-- replace getPublicUrl() in index.html with signed URLs.
