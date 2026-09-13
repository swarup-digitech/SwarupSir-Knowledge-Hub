-- Run this once in Supabase SQL Editor.
-- Allows teachers to delete their own assignments and the related
-- student submissions/answers.

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assignments' and policyname='Teachers can delete their assignments') then
    create policy "Teachers can delete their assignments" on public.assignments
      for delete to public using (created_by = auth.uid());
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='assignment_students' and policyname='Teachers can delete assignment recipients') then
    create policy "Teachers can delete assignment recipients" on public.assignment_students
      for delete to public using (exists (
        select 1 from public.assignments a
        where a.id = assignment_students.assignment_id
          and a.created_by = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='questions' and policyname='Teachers can delete assignment questions') then
    create policy "Teachers can delete assignment questions" on public.questions
      for delete to public using (exists (
        select 1 from public.assignments a
        where a.id = questions.assignment_id
          and a.created_by = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='attempts' and policyname='Teachers can delete attempts') then
    create policy "Teachers can delete attempts" on public.attempts
      for delete to public using (exists (
        select 1 from public.assignments a
        where a.id = attempts.assignment_id
          and a.created_by = auth.uid()
      ));
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='answers' and policyname='Teachers can delete answers') then
    create policy "Teachers can delete answers" on public.answers
      for delete to public using (exists (
        select 1
        from public.attempts at
        join public.assignments a on a.id = at.assignment_id
        where at.id = answers.attempt_id
          and a.created_by = auth.uid()
      ));
  end if;
end $$;
