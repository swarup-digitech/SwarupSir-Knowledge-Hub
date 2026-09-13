-- Mock Test Question Bank + Generated Tests
-- Run once in Supabase SQL Editor.

create table if not exists public.mock_question_bank (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  section_code text not null,
  part_code text not null,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text not null check (correct_option in ('A','B','C','D')),
  passage_text text,
  passage_id text,
  passage_title text,
  image_url text,
  source_type text,
  question_order integer,
  source_question_no integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_tests (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  time_limit_seconds integer not null default 7200 check (time_limit_seconds > 0),
  status text not null default 'published',
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
  marks numeric not null default 1.25
);

create table if not exists public.mock_test_students (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(mock_test_id, student_id)
);

create table if not exists public.mock_test_attempts (
  id uuid primary key default gen_random_uuid(),
  mock_test_id uuid not null references public.mock_tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'in_progress',
  submitted_at timestamptz,
  score numeric not null default 0,
  percentage numeric not null default 0,
  total_questions integer not null default 80,
  total_marks numeric not null default 100,
  section_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mock_test_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.mock_test_attempts(id) on delete cascade,
  question_id uuid not null references public.mock_test_questions(id) on delete cascade,
  selected_option text check (selected_option in ('A','B','C','D')),
  created_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

create index if not exists idx_mock_bank_teacher_part on public.mock_question_bank(teacher_id, part_code, active);
create index if not exists idx_mock_test_teacher on public.mock_tests(teacher_id, created_at desc);
create index if not exists idx_mock_test_questions_test on public.mock_test_questions(mock_test_id, question_number);
create index if not exists idx_mock_test_students_student on public.mock_test_students(student_id, mock_test_id);
create index if not exists idx_mock_attempts_student on public.mock_test_attempts(student_id, mock_test_id, created_at desc);
create index if not exists idx_mock_answers_attempt on public.mock_test_answers(attempt_id);

alter table public.mock_question_bank enable row level security;
alter table public.mock_tests enable row level security;
alter table public.mock_test_questions enable row level security;
alter table public.mock_test_students enable row level security;
alter table public.mock_test_attempts enable row level security;
alter table public.mock_test_answers enable row level security;

-- Teacher policies. Drop/recreate so this script is safe to rerun.
drop policy if exists mock_bank_teacher_select on public.mock_question_bank;
drop policy if exists mock_bank_teacher_insert on public.mock_question_bank;
drop policy if exists mock_bank_teacher_update on public.mock_question_bank;
drop policy if exists mock_bank_teacher_delete on public.mock_question_bank;
create policy mock_bank_teacher_select on public.mock_question_bank for select to authenticated using (teacher_id = auth.uid());
create policy mock_bank_teacher_insert on public.mock_question_bank for insert to authenticated with check (teacher_id = auth.uid());
create policy mock_bank_teacher_update on public.mock_question_bank for update to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());
create policy mock_bank_teacher_delete on public.mock_question_bank for delete to authenticated using (teacher_id = auth.uid());

drop policy if exists mock_tests_teacher_all on public.mock_tests;
create policy mock_tests_teacher_all on public.mock_tests for all to authenticated using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

drop policy if exists mock_tests_student_select on public.mock_tests;
create policy mock_tests_student_select on public.mock_tests for select to authenticated
using (exists (select 1 from public.mock_test_students s where s.mock_test_id = id and s.student_id = auth.uid()));

drop policy if exists mock_test_questions_teacher_all on public.mock_test_questions;
create policy mock_test_questions_teacher_all on public.mock_test_questions for all to authenticated
using (exists (select 1 from public.mock_tests t where t.id = mock_test_id and t.teacher_id = auth.uid()))
with check (exists (select 1 from public.mock_tests t where t.id = mock_test_id and t.teacher_id = auth.uid()));

drop policy if exists mock_test_students_teacher_all on public.mock_test_students;
create policy mock_test_students_teacher_all on public.mock_test_students for all to authenticated
using (exists (select 1 from public.mock_tests t where t.id = mock_test_id and t.teacher_id = auth.uid()))
with check (exists (select 1 from public.mock_tests t where t.id = mock_test_id and t.teacher_id = auth.uid()));

drop policy if exists mock_attempts_teacher_select on public.mock_test_attempts;
create policy mock_attempts_teacher_select on public.mock_test_attempts for select to authenticated
using (exists (select 1 from public.mock_tests t where t.id = mock_test_id and t.teacher_id = auth.uid()));

drop policy if exists mock_attempts_student_select on public.mock_test_attempts;
drop policy if exists mock_attempts_student_insert on public.mock_test_attempts;
drop policy if exists mock_attempts_student_update on public.mock_test_attempts;
create policy mock_attempts_student_select on public.mock_test_attempts for select to authenticated using (student_id = auth.uid());
create policy mock_attempts_student_insert on public.mock_test_attempts for insert to authenticated with check (student_id = auth.uid() and exists (select 1 from public.mock_test_students s where s.mock_test_id = mock_test_id and s.student_id = auth.uid()));
create policy mock_attempts_student_update on public.mock_test_attempts for update to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists mock_test_answers_student_all on public.mock_test_answers;
create policy mock_test_answers_student_all on public.mock_test_answers for all to authenticated
using (exists (select 1 from public.mock_test_attempts a where a.id = attempt_id and a.student_id = auth.uid()))
with check (exists (select 1 from public.mock_test_attempts a where a.id = attempt_id and a.student_id = auth.uid()));

drop policy if exists mock_test_questions_student_select on public.mock_test_questions;
create policy mock_test_questions_student_select on public.mock_test_questions for select to authenticated
using (exists (select 1 from public.mock_test_students s where s.mock_test_id = mock_test_id and s.student_id = auth.uid()));

drop policy if exists mock_test_students_student_select on public.mock_test_students;
create policy mock_test_students_student_select on public.mock_test_students for select to authenticated using (student_id = auth.uid());

-- Public read is enabled because generated PDF question images are stored in a public bucket.
insert into storage.buckets (id, name, public)
values ('mock-question-images','mock-question-images',true)
on conflict (id) do update set public = true;

drop policy if exists mock_question_images_public_read on storage.objects;
create policy mock_question_images_public_read on storage.objects for select using (bucket_id = 'mock-question-images');

drop policy if exists mock_question_images_teacher_insert on storage.objects;
create policy mock_question_images_teacher_insert on storage.objects for insert to authenticated
with check (bucket_id = 'mock-question-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mock_question_images_teacher_update on storage.objects;
create policy mock_question_images_teacher_update on storage.objects for update to authenticated
using (bucket_id = 'mock-question-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'mock-question-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists mock_question_images_teacher_delete on storage.objects;
create policy mock_question_images_teacher_delete on storage.objects for delete to authenticated
using (bucket_id = 'mock-question-images' and (storage.foldername(name))[1] = auth.uid()::text);
