create policy "Teachers can view students in their classes"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.class_students cs
    join public.classes c on c.id = cs.class_id
    where cs.student_id = profiles.id
      and c.teacher_id = auth.uid()
  )
);
