-- Solution images for JNVST/course assignments imported through Method 2.
-- Run once in Supabase SQL Editor.

alter table public.questions
  add column if not exists solution_image_url text null;

comment on column public.questions.solution_image_url is
  'Optional cropped solution image generated from one page of a solution PDF.';

insert into storage.buckets (id, name, public)
values ('assignment-solution-images', 'assignment-solution-images', true)
on conflict (id) do update set public = true;

drop policy if exists "assignment solution images public read" on storage.objects;
create policy "assignment solution images public read"
on storage.objects for select to public
using (bucket_id = 'assignment-solution-images');

drop policy if exists "assignment solution images teacher upload" on storage.objects;
create policy "assignment solution images teacher upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'assignment-solution-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "assignment solution images teacher update" on storage.objects;
create policy "assignment solution images teacher update"
on storage.objects for update to authenticated
using (
  bucket_id = 'assignment-solution-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'assignment-solution-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "assignment solution images teacher delete" on storage.objects;
create policy "assignment solution images teacher delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'assignment-solution-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
