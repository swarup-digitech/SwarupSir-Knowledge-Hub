-- Assignment Question Editor storage support
-- Safe to run once in Supabase SQL Editor.

insert into storage.buckets (id, name, public)
values ('assignment-question-images', 'assignment-question-images', true)
on conflict (id) do update set public = true;

create or replace function public.is_assignment_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'teacher'
  );
$$;

drop policy if exists "assignment question images teacher upload" on storage.objects;
create policy "assignment question images teacher upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-question-images'
  and public.is_assignment_teacher()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "assignment question images teacher delete" on storage.objects;
create policy "assignment question images teacher delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'assignment-question-images'
  and public.is_assignment_teacher()
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- The existing teacher question policies from complete_database_migrations.sql
-- permit teachers to update/delete questions belonging to their own assignments.
