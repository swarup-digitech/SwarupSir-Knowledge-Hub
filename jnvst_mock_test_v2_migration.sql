-- JNVST Mock Test V2
-- Run AFTER mock_test.sql / mock_question_bank_migration.sql.
-- Safe to re-run.

alter table public.mock_question_bank add column if not exists set_id text;
alter table public.mock_question_bank add column if not exists times_used integer not null default 0;
alter table public.mock_question_bank add column if not exists last_used_at timestamptz;

create index if not exists idx_mock_bank_teacher_set on public.mock_question_bank(teacher_id,part_code,set_id,active);
create index if not exists idx_mock_bank_teacher_passage_v2 on public.mock_question_bank(teacher_id,part_code,passage_id,active);

-- Convert the old four fixed Language banks into one generic Language passage bank.
-- Existing passage IDs are preserved; old banks remain usable through their passage IDs.
update public.mock_question_bank
set part_code = 'LANGUAGE_PASSAGE', section_code = 'LANGUAGE'
where section_code = 'LANGUAGE'
  and part_code in ('LANG_P1','LANG_P2','LANG_P3','LANG_P4');

-- Give legacy rows stable set IDs where a passage ID exists.
update public.mock_question_bank
set set_id = passage_id
where section_code = 'LANGUAGE'
  and part_code = 'LANGUAGE_PASSAGE'
  and nullif(trim(set_id),'') is null
  and nullif(trim(passage_id),'') is not null;

-- Stable set IDs for existing non-passage questions that do not have one.
with ranked as (
  select id, part_code,
         row_number() over(partition by teacher_id, part_code order by created_at, id) as rn
  from public.mock_question_bank
  where nullif(trim(coalesce(set_id,'')),'') is null
    and part_code in ('MAT_PATTERN','MAT_SERIES','MAT_GEOMETRICAL','MAT_MIRROR','MAT_EMBEDDED','EVS_MCQ','ARITHMETIC')
), assigned as (
  select id, part_code,
         floor((rn-1)/case when part_code like 'MAT_%' then 4 when part_code='EVS_MCQ' then 15 else 20 end)+1 as set_no
  from ranked
)
update public.mock_question_bank q
set set_id = a.part_code || '-' || lpad(a.set_no::text,3,'0')
from assigned a
where q.id=a.id;

-- Optional helper for teachers/admins to inspect bank readiness.
create or replace view public.mock_question_bank_readiness as
select teacher_id, section_code, part_code,
       count(*) filter(where active) as active_questions,
       count(distinct set_id) filter(where active and nullif(trim(coalesce(set_id,'')),'') is not null) as labelled_sets,
       count(distinct passage_id) filter(where active and nullif(trim(coalesce(passage_id,'')),'') is not null) as passage_groups
from public.mock_question_bank
group by teacher_id, section_code, part_code;
