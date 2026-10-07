-- School Course Subject Management
-- Safe additive migration. JNVST subjects remain separate.
create extension if not exists pgcrypto;

create table if not exists public.school_subjects (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_school_subjects_teacher_name
  on public.school_subjects(teacher_id, lower(trim(name)));
create index if not exists idx_school_subjects_teacher_active
  on public.school_subjects(teacher_id, active, lower(name));

alter table public.school_question_bank_chapters
  add column if not exists subject_id uuid references public.school_subjects(id) on delete set null;

alter table public.school_question_bank_questions
  add column if not exists subject_id uuid references public.school_subjects(id) on delete set null;

alter table public.school_assessments
  add column if not exists subject_id uuid references public.school_subjects(id) on delete set null;

alter table public.assignments
  add column if not exists school_subject_id uuid references public.school_subjects(id) on delete set null;

create index if not exists idx_school_qb_chapters_subject
  on public.school_question_bank_chapters(teacher_id, subject_id);
create index if not exists idx_school_qb_questions_subject_id
  on public.school_question_bank_questions(teacher_id, course_type, subject_id);
create index if not exists idx_school_assessments_subject
  on public.school_assessments(created_by, subject_id);
create index if not exists idx_school_assignments_subject
  on public.assignments(created_by, school_subject_id);

alter table public.school_subjects enable row level security;
drop policy if exists school_subjects_teacher_all on public.school_subjects;
create policy school_subjects_teacher_all on public.school_subjects
for all to authenticated
using (teacher_id=auth.uid())
with check (teacher_id=auth.uid());

-- Create the required legacy/default subject for every School teacher who already
-- has School Question Bank / Assessment data.
insert into public.school_subjects(teacher_id,name,code)
select distinct teacher_id,'Mathematics','MAT'
from (
  select teacher_id from public.school_question_bank_questions where course_type='SCHOOL'
  union
  select created_by as teacher_id from public.school_assessments
  union
  select teacher_id from public.classes where upper(coalesce(course,''))='SCHOOL'
) x
where teacher_id is not null
on conflict (teacher_id, lower(trim(name))) do nothing;

-- Backfill all existing School Question Bank records to Mathematics when they
-- have no subject yet. This is intentionally limited to course_type=SCHOOL.
update public.school_question_bank_questions q
set subject_id=s.id,
    updated_at=now()
from public.school_subjects s
where s.teacher_id=q.teacher_id
  and lower(trim(s.name))='mathematics'
  and q.course_type='SCHOOL';

-- Backfill School chapters from their existing questions where possible;
-- otherwise existing chapters are assigned to Mathematics for compatibility.
update public.school_question_bank_chapters c
set subject_id=s.id
from public.school_subjects s
where s.teacher_id=c.teacher_id
  and lower(trim(s.name))='mathematics'
  and c.subject_id is null;

update public.school_assessments a
set subject_id=s.id
from public.school_subjects s
where s.teacher_id=a.created_by
  and lower(trim(s.name))=lower(trim(coalesce(a.subject,'Mathematics')))
  and a.subject_id is null;

-- Existing School assignments carry a text subject. Link matching subjects.
update public.assignments a
set school_subject_id=s.id
from public.school_subjects s
where a.created_by=s.teacher_id
  and exists (select 1 from public.classes c where c.id=a.class_id and upper(coalesce(c.course,''))='SCHOOL')
  and a.school_subject_id is null
  and lower(trim(coalesce(a.subject,'')))=lower(trim(s.name));

-- Any old School assignment with no subject is linked to Mathematics.
update public.assignments a
set school_subject_id=s.id,
    subject=coalesce(nullif(trim(a.subject),''),'Mathematics')
from public.school_subjects s
where a.created_by=s.teacher_id
  and exists (select 1 from public.classes c where c.id=a.class_id and upper(coalesce(c.course,''))='SCHOOL')
  and lower(trim(s.name))='mathematics'
  and a.school_subject_id is null;

select 'School Subject Management migration complete' as status;
