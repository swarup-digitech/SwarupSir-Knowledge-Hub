-- JNVST Mock Test V3: Assamese / English language support
-- Run AFTER mock_test.sql, mock_question_bank_migration.sql and jnvst_mock_test_v2_migration.sql.
-- Safe to re-run.

alter table public.mock_question_bank add column if not exists language text;
alter table public.mock_tests add column if not exists language text;
alter table public.mock_test_questions add column if not exists language text;

-- Allowed values: MAT is COMMON; EVS/Arithmetic/Language are ASSAMESE or ENGLISH.
update public.mock_question_bank
set language='COMMON'
where section_code='MAT' and (language is null or upper(language) not in ('COMMON'));

-- Legacy Language records came from the single-language V2 bank. Preserve them as Assamese
-- so the existing bank remains usable; upload the English equivalents separately.
update public.mock_question_bank
set language='ASSAMESE'
where section_code='LANGUAGE' and part_code='LANGUAGE_PASSAGE' and language is null;

update public.mock_question_bank
set language=upper(trim(language))
where language is not null;

update public.mock_tests
set language='ASSAMESE'
where language is null;

update public.mock_test_questions q
set language=t.language
from public.mock_tests t
where q.mock_test_id=t.id and q.language is null;

create index if not exists idx_mock_bank_teacher_part_lang
on public.mock_question_bank(teacher_id, section_code, part_code, language, active);
create index if not exists idx_mock_tests_teacher_language
on public.mock_tests(teacher_id, language, created_at desc);

-- Readiness view with language dimension.
drop view if exists public.mock_question_bank_readiness_v3;
create view public.mock_question_bank_readiness_v3 as
select teacher_id, section_code, part_code, coalesce(language,'UNSPECIFIED') as language,
       count(*) filter(where active) as active_questions,
       count(distinct set_id) filter(where active and nullif(trim(coalesce(set_id,'')),'') is not null) as labelled_sets,
       count(distinct passage_id) filter(where active and nullif(trim(coalesce(passage_id,'')),'') is not null) as passage_groups
from public.mock_question_bank
group by teacher_id, section_code, part_code, coalesce(language,'UNSPECIFIED');
