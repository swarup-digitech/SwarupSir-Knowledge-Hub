-- Teacher-viewable student login credentials.
-- WARNING: password_plaintext intentionally stores the classroom login password
-- in plain text because the teacher requested to view it. Do not reuse these
-- passwords for any personal or sensitive account.

create table if not exists public.student_credentials (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  email text not null,
  password_plaintext text not null,
  updated_at timestamptz not null default now()
);

alter table public.student_credentials enable row level security;

-- The web app does NOT read this table directly. The teacher-only Edge Function
-- uses the service-role key after verifying the caller is a teacher.
-- Therefore no client SELECT/INSERT/UPDATE policies are intentionally created.
