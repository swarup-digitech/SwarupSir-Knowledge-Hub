-- ============================================================
-- STUDENT FEES / SUBSCRIPTION MANAGEMENT
-- Run once in Supabase SQL Editor.
-- ============================================================

create table if not exists public.student_fee_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete restrict,
  group_id uuid null references public.classes(id) on delete set null,
  course_name text null,
  total_course_fee numeric(12,2) not null default 0 check (total_course_fee >= 0),
  discount_amount numeric(12,2) not null default 0 check (discount_amount >= 0),
  message text null,
  message_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id)
);

create table if not exists public.student_fee_payments (
  id uuid primary key default gen_random_uuid(),
  fee_account_id uuid not null references public.student_fee_accounts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  payment_mode text null,
  reference_no text null,
  remarks text null,
  import_batch_id text null,
  source_row_number integer null,
  created_at timestamptz not null default now(),
  created_by uuid null references public.profiles(id) on delete set null
);

create index if not exists idx_student_fee_accounts_teacher on public.student_fee_accounts(teacher_id);
create index if not exists idx_student_fee_accounts_student on public.student_fee_accounts(student_id);
create index if not exists idx_student_fee_payments_account on public.student_fee_payments(fee_account_id);
create index if not exists idx_student_fee_payments_student on public.student_fee_payments(student_id);
create index if not exists idx_student_fee_payments_batch on public.student_fee_payments(import_batch_id);

-- Keep updated_at current when an account is edited.
create or replace function public.touch_student_fee_account_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_student_fee_accounts_updated_at on public.student_fee_accounts;
create trigger trg_student_fee_accounts_updated_at
before update on public.student_fee_accounts
for each row execute function public.touch_student_fee_account_updated_at();

alter table public.student_fee_accounts enable row level security;
alter table public.student_fee_payments enable row level security;

drop policy if exists "Students can view own fee account" on public.student_fee_accounts;
create policy "Students can view own fee account"
on public.student_fee_accounts
for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Teachers can view own fee accounts" on public.student_fee_accounts;
create policy "Teachers can view own fee accounts"
on public.student_fee_accounts
for select to authenticated
using (teacher_id = auth.uid());

drop policy if exists "Students can view own fee payments" on public.student_fee_payments;
create policy "Students can view own fee payments"
on public.student_fee_payments
for select to authenticated
using (student_id = auth.uid());

drop policy if exists "Teachers can view own fee payments" on public.student_fee_payments;
create policy "Teachers can view own fee payments"
on public.student_fee_payments
for select to authenticated
using (
  exists (
    select 1 from public.student_fee_accounts a
    where a.id = student_fee_payments.fee_account_id
      and a.teacher_id = auth.uid()
  )
);

-- No direct student INSERT/UPDATE/DELETE policies are created.
-- Teachers modify fee data through the authenticated Edge Function,
-- which validates teacher ownership before every change.

comment on table public.student_fee_accounts is 'One current course-fee account per student.';
comment on table public.student_fee_payments is 'Individual fee payment transactions; Total Paid is calculated from these rows.';
