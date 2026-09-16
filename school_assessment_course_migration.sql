-- School Course + School Assessment supporting migration
-- Safe to run on an existing project. Uses IF NOT EXISTS where possible.

create extension if not exists pgcrypto;

alter table if exists profiles add column if not exists course text;
alter table if exists profiles add column if not exists school_group_id uuid;

alter table if exists classes add column if not exists course text;

create table if not exists school_course_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  teacher_id uuid not null references profiles(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists school_assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text,
  class_id uuid not null references classes(id) on delete cascade,
  school_group_id uuid references school_course_groups(id) on delete set null,
  deadline timestamptz,
  created_by uuid not null references profiles(id) on delete cascade,
  total_marks numeric(10,2),
  created_at timestamptz not null default now()
);

create table if not exists school_questions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references school_assessments(id) on delete cascade,
  question_order integer not null,
  question_text text not null,
  marks numeric(10,2) not null default 1,
  created_at timestamptz not null default now(),
  unique(assessment_id,question_order)
);

create table if not exists school_answer_submissions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references school_assessments(id) on delete cascade,
  question_id uuid not null references school_questions(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  submission_no integer not null default 1,
  is_current boolean not null default true,
  status text not null default 'submitted' check(status in ('submitted','reviewed')),
  awarded_marks numeric(10,2),
  teacher_comment text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null
);

create table if not exists school_answer_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references school_answer_submissions(id) on delete cascade,
  page_no integer not null,
  file_name text not null,
  drive_url text,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists idx_school_groups_teacher on school_course_groups(teacher_id);
create index if not exists idx_school_groups_class on school_course_groups(class_id);
create index if not exists idx_school_assessments_teacher on school_assessments(created_by);
create index if not exists idx_school_assessments_class on school_assessments(class_id);
create index if not exists idx_school_assessments_group on school_assessments(school_group_id);
create index if not exists idx_school_questions_assessment on school_questions(assessment_id);
create index if not exists idx_school_submissions_student_assessment on school_answer_submissions(student_id,assessment_id,is_current);
create index if not exists idx_school_submissions_question on school_answer_submissions(question_id,is_current);
create index if not exists idx_school_files_submission on school_answer_files(submission_id);

-- At most one current submission per student/question/assessment.
create unique index if not exists ux_school_current_submission
on school_answer_submissions(student_id,assessment_id,question_id)
where is_current=true;

-- Helpers avoid recursive RLS checks when class membership is evaluated.
create or replace function is_school_teacher(uid uuid)
returns boolean
language sql security definer set search_path=public
stable
as $$ select exists(select 1 from profiles where id=uid and role='teacher'); $$;

create or replace function is_school_student(uid uuid)
returns boolean
language sql security definer set search_path=public
stable
as $$ select exists(select 1 from profiles where id=uid and role='student' and upper(coalesce(course,''))='SCHOOL'); $$;

create or replace function is_teacher_for_school_class(uid uuid,cid uuid)
returns boolean
language sql security definer set search_path=public
stable
as $$ select exists(select 1 from classes where id=cid and teacher_id=uid and upper(coalesce(course,''))='SCHOOL'); $$;

create or replace function student_in_class(uid uuid,cid uuid)
returns boolean
language sql security definer set search_path=public
stable
as $$ select exists(select 1 from class_students where student_id=uid and class_id=cid); $$;

alter table school_course_groups enable row level security;
alter table school_assessments enable row level security;
alter table school_questions enable row level security;
alter table school_answer_submissions enable row level security;
alter table school_answer_files enable row level security;

drop policy if exists school_groups_teacher_all on school_course_groups;
create policy school_groups_teacher_all on school_course_groups
for all using (is_school_teacher(auth.uid()) and teacher_id=auth.uid())
with check (is_school_teacher(auth.uid()) and teacher_id=auth.uid());

drop policy if exists school_assessments_teacher_all on school_assessments;
create policy school_assessments_teacher_all on school_assessments
for all using (is_school_teacher(auth.uid()) and created_by=auth.uid())
with check (is_school_teacher(auth.uid()) and created_by=auth.uid());

drop policy if exists school_assessments_student_read on school_assessments;
create policy school_assessments_student_read on school_assessments
for select using (
  is_school_student(auth.uid())
  and student_in_class(auth.uid(),class_id)
  and (school_group_id is null or school_group_id=(select school_group_id from profiles where id=auth.uid()))
);

drop policy if exists school_questions_teacher_all on school_questions;
create policy school_questions_teacher_all on school_questions
for all using (exists(select 1 from school_assessments a where a.id=assessment_id and is_school_teacher(auth.uid()) and a.created_by=auth.uid()))
with check (exists(select 1 from school_assessments a where a.id=assessment_id and is_school_teacher(auth.uid()) and a.created_by=auth.uid()));

drop policy if exists school_questions_student_read on school_questions;
create policy school_questions_student_read on school_questions
for select using (
  exists(
    select 1 from school_assessments a
    where a.id=assessment_id
      and is_school_student(auth.uid())
      and student_in_class(auth.uid(),a.class_id)
      and (a.school_group_id is null or a.school_group_id=(select school_group_id from profiles where id=auth.uid()))
  )
);

drop policy if exists school_submissions_teacher_all on school_answer_submissions;
create policy school_submissions_teacher_all on school_answer_submissions
for all using (
  is_school_teacher(auth.uid())
  and exists(select 1 from school_assessments a where a.id=assessment_id and a.created_by=auth.uid())
)
with check (
  is_school_teacher(auth.uid())
  and exists(select 1 from school_assessments a where a.id=assessment_id and a.created_by=auth.uid())
);

drop policy if exists school_submissions_student_read_insert on school_answer_submissions;
create policy school_submissions_student_read_insert on school_answer_submissions
for select using (is_school_student(auth.uid()) and student_id=auth.uid());

drop policy if exists school_submissions_student_insert on school_answer_submissions;
create policy school_submissions_student_insert on school_answer_submissions
for insert with check (
  is_school_student(auth.uid())
  and student_id=auth.uid()
  and exists(
    select 1 from school_assessments a
    where a.id=assessment_id
      and student_in_class(auth.uid(),a.class_id)
      and (a.school_group_id is null or a.school_group_id=(select school_group_id from profiles where id=auth.uid()))
  )
  and not exists(
    select 1 from school_answer_submissions s
    where s.student_id=auth.uid()
      and s.assessment_id=assessment_id
      and s.question_id=question_id
      and s.is_current=true
      and s.status='reviewed'
  )
);

drop policy if exists school_files_teacher_all on school_answer_files;
create policy school_files_teacher_all on school_answer_files
for all using (
  is_school_teacher(auth.uid())
  and exists(
    select 1 from school_answer_submissions s
    join school_assessments a on a.id=s.assessment_id
    where s.id=submission_id and a.created_by=auth.uid()
  )
)
with check (
  is_school_teacher(auth.uid())
  and exists(
    select 1 from school_answer_submissions s
    join school_assessments a on a.id=s.assessment_id
    where s.id=submission_id and a.created_by=auth.uid()
  )
);

drop policy if exists school_files_student_read on school_answer_files;
create policy school_files_student_read on school_answer_files
for select using (
  is_school_student(auth.uid())
  and exists(select 1 from school_answer_submissions s where s.id=submission_id and s.student_id=auth.uid())
);

-- Students never directly insert answer files; the Edge Function uses the service role.
