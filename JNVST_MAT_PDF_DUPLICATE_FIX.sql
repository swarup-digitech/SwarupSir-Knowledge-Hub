-- Optional optimization for JNVST MAT PDF duplicate detection.
alter table public.mock_question_bank add column if not exists source_image_hash text;
create index if not exists idx_mock_qb_source_image_hash on public.mock_question_bank(source_image_hash) where source_image_hash is not null;
