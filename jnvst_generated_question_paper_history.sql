-- JNVST Question Paper Generation History
-- Run once in Supabase SQL Editor. Safe to rerun.

create table if not exists public.jnvst_generated_question_papers (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'JNVST Practice Question Paper',
  serial_no text not null,
  set_code text not null default 'A',
  subject text not null,
  language text,
  mode text,
  question_count integer not null default 0,
  total_marks numeric not null default 0,
  generated_at timestamptz not null default now(),
  paper_snapshot jsonb not null default '{}'::jsonb,
  answer_key_snapshot jsonb not null default '{}'::jsonb
);

create index if not exists idx_jnvst_generated_qp_teacher_date
  on public.jnvst_generated_question_papers(teacher_id, generated_at desc);

create index if not exists idx_jnvst_generated_qp_teacher_serial
  on public.jnvst_generated_question_papers(teacher_id, serial_no);

alter table public.jnvst_generated_question_papers enable row level security;

drop policy if exists jnvst_generated_qp_teacher_select on public.jnvst_generated_question_papers;
drop policy if exists jnvst_generated_qp_teacher_insert on public.jnvst_generated_question_papers;
drop policy if exists jnvst_generated_qp_teacher_delete on public.jnvst_generated_question_papers;
drop policy if exists jnvst_generated_qp_teacher_update on public.jnvst_generated_question_papers;

create policy jnvst_generated_qp_teacher_select
on public.jnvst_generated_question_papers for select to authenticated
using (teacher_id = auth.uid());

create policy jnvst_generated_qp_teacher_insert
on public.jnvst_generated_question_papers for insert to authenticated
with check (teacher_id = auth.uid());

create policy jnvst_generated_qp_teacher_delete
on public.jnvst_generated_question_papers for delete to authenticated
using (teacher_id = auth.uid());

create policy jnvst_generated_qp_teacher_update
on public.jnvst_generated_question_papers for update to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());
