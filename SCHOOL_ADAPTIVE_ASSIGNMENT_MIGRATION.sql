-- School Course Adaptive Assignment Add-on
-- Safe additive migration. Existing assignments remain standard unless adaptive_mode=true.

alter table public.questions
  add column if not exists source_school_question_bank_id uuid;
alter table public.questions
  add column if not exists source_variation_group text;
alter table public.questions
  add column if not exists source_chapter_id uuid;
alter table public.questions
  add column if not exists source_topic text;
alter table public.questions
  add column if not exists adaptive_selection_reason text;
alter table public.questions
  add column if not exists adaptive_source_wrong_question_id uuid;
alter table public.questions
  add column if not exists adaptive_source_wrong_count integer not null default 0;

alter table public.assignments
  add column if not exists adaptive_mode boolean not null default false;
alter table public.assignments
  add column if not exists adaptive_max_percent integer not null default 60;
alter table public.assignments
  add column if not exists adaptive_batch_id uuid;
alter table public.assignments
  add column if not exists adaptive_for_student_id uuid;
alter table public.assignments
  add column if not exists adaptive_weakness_count integer not null default 0;
alter table public.assignments
  add column if not exists adaptive_normal_count integer not null default 0;
alter table public.assignments
  add column if not exists adaptive_selection_summary jsonb;

create index if not exists idx_assignments_adaptive_batch
  on public.assignments(adaptive_batch_id);
create index if not exists idx_assignments_adaptive_student
  on public.assignments(adaptive_for_student_id);
create index if not exists idx_questions_source_school_qb
  on public.questions(source_school_question_bank_id);
create index if not exists idx_questions_source_variation
  on public.questions(source_variation_group);

create table if not exists public.school_student_question_performance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  source_school_question_bank_id uuid not null references public.school_question_bank_questions(id) on delete cascade,
  attempt_count integer not null default 0,
  wrong_count integer not null default 0,
  correct_count integer not null default 0,
  last_result boolean,
  first_wrong_at timestamptz,
  last_wrong_at timestamptz,
  last_correct_at timestamptz,
  last_attempted_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(student_id, source_school_question_bank_id)
);

create index if not exists idx_school_student_qperf_student_wrong
  on public.school_student_question_performance(student_id, wrong_count desc);
create index if not exists idx_school_student_qperf_source
  on public.school_student_question_performance(source_school_question_bank_id);

alter table public.school_student_question_performance enable row level security;

drop policy if exists school_student_qperf_student_read on public.school_student_question_performance;
create policy school_student_qperf_student_read
on public.school_student_question_performance
for select to authenticated
using (student_id = auth.uid());

drop policy if exists school_student_qperf_teacher_read on public.school_student_question_performance;
create policy school_student_qperf_teacher_read
on public.school_student_question_performance
for select to authenticated
using (
  exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = school_student_question_performance.student_id
      and c.teacher_id = auth.uid()
      and upper(coalesce(c.course,'')) = 'SCHOOL'
  )
);

create or replace function public.record_school_student_question_results(
  p_student_id uuid,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if auth.uid() is distinct from p_student_id then
    raise exception 'Not authorized';
  end if;

  for r in
    select *
    from jsonb_to_recordset(coalesce(p_results, '[]'::jsonb))
      as x(source_school_question_bank_id uuid, is_correct boolean)
    where source_school_question_bank_id is not null
  loop
    insert into public.school_student_question_performance
      (student_id, source_school_question_bank_id, attempt_count, wrong_count, correct_count,
       last_result, first_wrong_at, last_wrong_at, last_correct_at, last_attempted_at, updated_at)
    values
      (p_student_id, r.source_school_question_bank_id, 1,
       case when r.is_correct then 0 else 1 end,
       case when r.is_correct then 1 else 0 end,
       r.is_correct,
       case when r.is_correct then null else now() end,
       case when r.is_correct then null else now() end,
       case when r.is_correct then now() else null end,
       now(), now())
    on conflict (student_id, source_school_question_bank_id)
    do update set
      attempt_count = school_student_question_performance.attempt_count + 1,
      wrong_count = school_student_question_performance.wrong_count + case when r.is_correct then 0 else 1 end,
      correct_count = school_student_question_performance.correct_count + case when r.is_correct then 1 else 0 end,
      last_result = r.is_correct,
      first_wrong_at = case
        when r.is_correct then school_student_question_performance.first_wrong_at
        else coalesce(school_student_question_performance.first_wrong_at, now())
      end,
      last_wrong_at = case
        when r.is_correct then school_student_question_performance.last_wrong_at
        else now()
      end,
      last_correct_at = case
        when r.is_correct then now()
        else school_student_question_performance.last_correct_at
      end,
      last_attempted_at = now(),
      updated_at = now();
  end loop;
end;
$$;

revoke all on function public.record_school_student_question_results(uuid, jsonb) from public;
grant execute on function public.record_school_student_question_results(uuid, jsonb) to authenticated;

select 'School Adaptive Assignment add-on migration complete' as status;
