-- Student authentication: Roll No + Password only.
-- This removes email from the student credential table.
-- Teacher authentication continues to use the existing teacher login.

alter table public.student_credentials
  drop column if exists email;

-- Keep the Roll No unique among student accounts.
create unique index if not exists profiles_student_roll_no_unique
on public.profiles (roll_no)
where role = 'student' and roll_no is not null;

-- Ensure the credential table remains protected. The Edge Function is the
-- only component that reads/writes student passwords.
alter table public.student_credentials enable row level security;
