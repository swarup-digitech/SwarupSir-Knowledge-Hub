-- JNVST Bulk Upload Part-Code Repair
-- Purpose: repair older JNVST bulk-uploaded rows where individual EVS MCQs
-- were stored with section_code = EVS but part_code = EVS.
-- New uploads now write EVS_MCQ correctly.

begin;

-- Individual EVS MCQs
update public.mock_question_bank
set part_code = 'EVS_MCQ'
where section_code = 'EVS'
  and coalesce(part_code, '') = 'EVS'
  and coalesce(passage_id, '') = ''
  and coalesce(question_type, 'MCQ') not in ('EVS-PASSAGE','EVS_PASSAGE');

-- EVS passage rows: ensure the part code is explicit.
update public.mock_question_bank
set part_code = 'EVS_PASSAGE'
where section_code = 'EVS'
  and (
    coalesce(question_type, '') in ('EVS-PASSAGE','EVS_PASSAGE')
    or coalesce(passage_id, '') <> ''
  );

-- Language passage rows: ensure the part code is explicit.
update public.mock_question_bank
set part_code = 'LANGUAGE_PASSAGE'
where section_code = 'LANGUAGE'
  and (
    coalesce(question_type, '') in ('LANGUAGE-PASSAGE','LANGUAGE_PASSAGE')
    or coalesce(passage_id, '') <> ''
  );

-- Arithmetic rows.
update public.mock_question_bank
set part_code = 'ARITHMETIC'
where section_code = 'ARITHMETIC'
  and coalesce(part_code, '') = '';

commit;

-- Refresh PostgREST so the updated data/schema is immediately reflected.
notify pgrst, 'reload schema';

-- Verification
select
  section_code,
  part_code,
  count(*) as question_count
from public.mock_question_bank
where active = true
  and section_code in ('EVS','LANGUAGE','ARITHMETIC')
group by section_code, part_code
order by section_code, part_code;
