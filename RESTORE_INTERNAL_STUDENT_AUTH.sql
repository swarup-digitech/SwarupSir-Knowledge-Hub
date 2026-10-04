-- Restore the internal Supabase Auth email required by the existing
-- Roll No. + Password student-login architecture.
-- IMPORTANT: This is NOT a student-facing email address.

alter table public.student_credentials
  add column if not exists email text;

-- Existing Auth users already have their internal Auth email. Re-link it.
update public.student_credentials sc
set email = au.email
from auth.users au
where au.id = sc.student_id
  and coalesce(sc.email, '') = ''
  and au.email is not null;

-- Any credential row without a matching Auth user cannot be used for login.
-- Do not invent an email for such a row; the student should be recreated
-- through the create-students Edge Function.

delete from public.student_credentials sc
where coalesce(sc.email, '') = ''
  and not exists (
    select 1 from auth.users au where au.id = sc.student_id
  );

alter table public.student_credentials
  alter column email set not null;

alter table public.student_credentials enable row level security;
