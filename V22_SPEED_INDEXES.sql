-- =============================================================================
-- V22 — Faster Teacher Admin Panel (database part)
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor. Safe to re-run. Changes no data.
--
-- 1. Adds indexes for the lookups the teacher screens use most
--    (questions of an assignment, answers of an attempt, students of a class …).
--    Without them the database reads the whole table for every lookup, which gets
--    slower every week as attempts and answers grow.
--    Each index is only created if its table and columns exist.
--
-- 2. Makes the "Teachers can view students in their classes" rule cheaper:
--    auth.uid() is wrapped in (select auth.uid()) so the database works it out once
--    per request instead of once for every student row (Supabase's own advice).
--    Who can see what does NOT change.
-- =============================================================================

do $$
declare
  ix record;
begin
  for ix in
    select * from (values
      ('idx_v22_questions_assignment',    'questions',           'assignment_id, question_order', array['assignment_id','question_order']),
      ('idx_v22_answers_attempt',         'answers',             'attempt_id, question_id',       array['attempt_id','question_id']),
      ('idx_v22_attempts_assignment',     'attempts',            'assignment_id, submitted_at desc', array['assignment_id','submitted_at']),
      ('idx_v22_attempts_student',        'attempts',            'student_id',                    array['student_id']),
      ('idx_v22_class_students_class',    'class_students',      'class_id',                      array['class_id']),
      ('idx_v22_class_students_student',  'class_students',      'student_id',                    array['student_id']),
      ('idx_v22_assignment_students_stu', 'assignment_students', 'student_id',                    array['student_id']),
      ('idx_v22_assignments_teacher',     'assignments',         'created_by, created_at desc',   array['created_by','created_at']),
      ('idx_v22_assignments_class',       'assignments',         'class_id',                      array['class_id']),
      ('idx_v22_profiles_role_course',    'profiles',            'role, course',                  array['role','course']),
      ('idx_v22_classes_teacher',         'classes',             'teacher_id, course',            array['teacher_id','course']),
      ('idx_v22_jnvst_lessons_teacher',   'jnvst_subject_lessons','teacher_id',                   array['teacher_id']),
      ('idx_v22_jnvst_subjects_teacher',  'jnvst_subjects',      'teacher_id',                    array['teacher_id']),
      ('idx_v22_mqb_teacher_created',     'mock_question_bank',  'teacher_id, created_at desc',   array['teacher_id','created_at'])
    ) as t(name, tbl, cols, needed)
  loop
    if to_regclass('public.' || ix.tbl) is not null
       and (select count(*) from information_schema.columns c
             where c.table_schema = 'public' and c.table_name = ix.tbl
               and c.column_name = any(ix.needed)) = array_length(ix.needed, 1)
    then
      execute format('create index if not exists %I on public.%I (%s)', ix.name, ix.tbl, ix.cols);
      raise notice 'index ready: % on %(%)', ix.name, ix.tbl, ix.cols;
    else
      raise notice 'skipped % (table or column not found)', ix.name;
    end if;
  end loop;
end $$;

-- 2. Same rule as before, only cheaper to check.
do $$
begin
  if exists (select 1 from pg_policies
              where schemaname = 'public' and tablename = 'profiles'
                and policyname = 'Teachers can view students in their classes') then
    drop policy "Teachers can view students in their classes" on public.profiles;
    create policy "Teachers can view students in their classes" on public.profiles
      for select to authenticated
      using (
        id = (select auth.uid())
        or exists (
          select 1
          from public.class_students cs
          join public.classes c on c.id = cs.class_id
          where cs.student_id = profiles.id
            and c.teacher_id = (select auth.uid())
        )
      );
  end if;
end $$;

-- Refresh the planner's statistics so the new indexes are used straight away.
do $$
declare t text;
begin
  foreach t in array array['questions','answers','attempts','class_students','assignments','profiles'] loop
    if to_regclass('public.' || t) is not null then execute format('analyze public.%I', t); end if;
  end loop;
end $$;

-- check: select indexname from pg_indexes where indexname like 'idx_v22_%' order by 1;
