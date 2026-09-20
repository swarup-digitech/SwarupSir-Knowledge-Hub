-- Mock Test result approval / release
-- Run once in Supabase SQL Editor. Safe to re-run.

alter table public.mock_tests
  add column if not exists results_released boolean not null default false;

create index if not exists idx_mock_tests_results_released
  on public.mock_tests(teacher_id, results_released, created_at desc);

-- Existing tests remain hidden until the teacher explicitly approves/releases results.
