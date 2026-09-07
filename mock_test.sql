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
create policy "mock bank teacher manage" on public.mock_question_bank for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "mock tests teacher manage" on public.mock_tests for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy "mock test questions teacher manage" on public.mock_test_questions for all to authenticated using (exists (select 1 from public.mock_tests t where t.id=mock_test_id and t.teacher_id=auth.uid())) with check (exists (select 1 from public.mock_tests t where t.id=mock_test_id and t.teacher_id=auth.uid()));
create policy "mock recipients teacher manage" on public.mock_test_students for all to authenticated using (exists (select 1 from public.mock_tests t where t.id=mock_test_id and t.teacher_id=auth.uid())) with check (exists (select 1 from public.mock_tests t where t.id=mock_test_id and t.teacher_id=auth.uid()));
create policy "mock attempts teacher read" on public.mock_test_attempts for select to authenticated using (exists (select 1 from public.mock_tests t where t.id=mock_test_id and t.teacher_id=auth.uid()));
create policy "mock answers teacher read" on public.mock_test_answers for select to authenticated using (exists (select 1 from public.mock_test_attempts a join public.mock_tests t on t.id=a.mock_test_id where a.id=attempt_id and t.teacher_id=auth.uid()));

-- Student policies
create policy "mock tests student assigned read" on public.mock_tests for select to authenticated using (exists (select 1 from public.mock_test_students s where s.mock_test_id=id and s.student_id=auth.uid()));
create policy "mock test questions student read" on public.mock_test_questions for select to authenticated using (exists (select 1 from public.mock_test_students s where s.mock_test_id=mock_test_id and s.student_id=auth.uid()));
create policy "mock recipients student read own" on public.mock_test_students for select to authenticated using (student_id=auth.uid());
create policy "mock attempts student own" on public.mock_test_attempts for all to authenticated using (student_id=auth.uid()) with check (student_id=auth.uid());
create policy "mock answers student own" on public.mock_test_answers for all to authenticated using (exists (select 1 from public.mock_test_attempts a where a.id=attempt_id and a.student_id=auth.uid())) with check (exists (select 1 from public.mock_test_attempts a where a.id=attempt_id and a.student_id=auth.uid()));

-- Public bucket for cropped question-page images. The URLs are intentionally used as image assets by the student test UI.
insert into storage.buckets (id,name,public) values ('mock-question-images','mock-question-images',true)
on conflict (id) do update set public=true;

create policy "mock image teacher upload" on storage.objects for insert to authenticated
with check (bucket_id='mock-question-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "mock image teacher delete" on storage.objects for delete to authenticated
using (bucket_id='mock-question-images' and (storage.foldername(name))[1]=auth.uid()::text);

-- Public read is provided by the public bucket. If you later make the bucket private,
-- replace getPublicUrl() in index.html with signed URLs.
