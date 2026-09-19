-- School Assessment recipient management
-- Run once after school_assessment_course_migration.sql

create table if not exists school_assessment_students (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references school_assessments(id) on delete cascade,
  student_id uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  unique(assessment_id, student_id)
);

create index if not exists idx_school_assessment_students_assessment on school_assessment_students(assessment_id);
create index if not exists idx_school_assessment_students_student on school_assessment_students(student_id);

alter table school_assessment_students enable row level security;

drop policy if exists school_assessment_students_teacher_all on school_assessment_students;
create policy school_assessment_students_teacher_all on school_assessment_students
for all using (
  exists(select 1 from school_assessments a where a.id=assessment_id and a.created_by=auth.uid())
)
with check (
  exists(select 1 from school_assessments a where a.id=assessment_id and a.created_by=auth.uid())
);

drop policy if exists school_assessment_students_student_read on school_assessment_students;
create policy school_assessment_students_student_read on school_assessment_students
for select using (student_id=auth.uid());

-- Backfill recipients for existing assessments using their current class/subdivision target.
insert into school_assessment_students(assessment_id,student_id)
select a.id, cs.student_id
from school_assessments a
join class_students cs on cs.class_id=a.class_id
join profiles p on p.id=cs.student_id
where a.school_group_id is null
  and not exists(select 1 from school_assessment_students x where x.assessment_id=a.id and x.student_id=cs.student_id)
on conflict (assessment_id,student_id) do nothing;

insert into school_assessment_students(assessment_id,student_id)
select a.id, cs.student_id
from school_assessments a
join class_students cs on cs.class_id=a.class_id
join profiles p on p.id=cs.student_id
where a.school_group_id is not null
  and p.school_group_id=a.school_group_id
  and not exists(select 1 from school_assessment_students x where x.assessment_id=a.id and x.student_id=cs.student_id)
on conflict (assessment_id,student_id) do nothing;
