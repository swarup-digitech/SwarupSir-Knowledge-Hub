-- Student login migration: Roll No + Password only
alter table public.profiles add column if not exists roll_no text;
create unique index if not exists profiles_student_roll_no_unique
on public.profiles (roll_no)
where role = 'student' and roll_no is not null;

-- Existing students: set their Roll No here before testing student login.
-- Example:
-- update public.profiles set roll_no = '1' where id = 'STUDENT-UUID-HERE';

-- Verify:
select id, full_name, roll_no, role from public.profiles where role='student' order by roll_no nulls last, full_name;
