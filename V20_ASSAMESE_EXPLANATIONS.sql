-- =============================================================================
-- V20 — Assamese explanations for the JNVST / Mock question bank
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor (after V18 and V19). Safe to re-run.
--
-- What it adds to public.mock_question_bank:
--   explanation_as         Assamese explanation (for ASSAMESE and COMMON/MAT rows)
--   explanation_as_status  PENDING  = waiting for automatic translation
--                          AUTO     = machine-translated, not yet checked by the teacher
--                          REVIEWED = typed or corrected by the teacher (never overwritten)
--                          FAILED   = translation failed (reason in explanation_as_error)
--   explanation_as_error   last translation error, if any
--
-- The English text stays in `explanation`. ENGLISH rows are not touched.
-- A trigger keeps the status right for every way questions are saved (bulk upload,
-- manual add, edit screens, mock-test uploads), so new questions are queued for
-- translation automatically. The Edge Function `translate-explanations` does the
-- translating; the teacher app calls it whenever the Question Bank is opened.
--
-- Also replaces student_omr_report() (from V18) so a student's OMR result report
-- shows the Assamese explanation for Assamese questions — including reports of
-- papers that were printed before this change.
-- =============================================================================

alter table public.mock_question_bank add column if not exists explanation_as text;
alter table public.mock_question_bank add column if not exists explanation_as_status text;
alter table public.mock_question_bank add column if not exists explanation_as_error text;

do $$ begin
  alter table public.mock_question_bank
    add constraint mock_qb_explanation_as_status_chk
    check (explanation_as_status is null or explanation_as_status in ('PENDING','AUTO','REVIEWED','FAILED'));
exception when duplicate_object then null; end $$;

comment on column public.mock_question_bank.explanation_as is
  'Assamese explanation. Shown to Assamese-medium students; COMMON (MAT) questions show English and Assamese.';
comment on column public.mock_question_bank.explanation_as_status is
  'PENDING / AUTO (machine translated, unchecked) / REVIEWED (teacher text, never auto-replaced) / FAILED.';

create index if not exists idx_mock_qb_explanation_as_pending
  on public.mock_question_bank(teacher_id, explanation_as_status)
  where explanation_as_status in ('PENDING','FAILED');

-- True when the text contains Bengali/Assamese script characters.
create or replace function public.jnvst_has_assamese_script(t text)
returns boolean language sql immutable as $$
  select coalesce(t ~ '[ঀ-৿]', false);
$$;

-- -----------------------------------------------------------------------------
-- Trigger: decides the status whenever a row is inserted or saved.
-- -----------------------------------------------------------------------------
create or replace function public.mock_qb_explanation_as_trg()
returns trigger
language plpgsql
as $$
declare
  v_lang text := upper(coalesce(new.language, ''));
  v_explicit boolean;
begin
  if v_lang not in ('ASSAMESE', 'COMMON') then
    return new;                                   -- English rows need no Assamese explanation
  end if;

  new.explanation    := nullif(btrim(coalesce(new.explanation, '')), '');
  new.explanation_as := nullif(btrim(coalesce(new.explanation_as, '')), '');

  -- Older screens put Assamese text straight into `explanation`: that already is the Assamese explanation.
  if new.explanation is not null and public.jnvst_has_assamese_script(new.explanation)
     and (new.explanation_as is null
          or (tg_op = 'UPDATE' and new.explanation is distinct from old.explanation
              and new.explanation_as is not distinct from old.explanation_as)) then
    new.explanation_as := new.explanation;
    new.explanation_as_status := 'REVIEWED';
    new.explanation_as_error := null;
    return new;
  end if;

  -- The translator (or a "re-translate" request) sets the status itself: respect it.
  v_explicit := (tg_op = 'INSERT' and new.explanation_as_status is not null)
             or (tg_op = 'UPDATE' and new.explanation_as_status is distinct from old.explanation_as_status);

  if not v_explicit then
    if new.explanation_as is not null
       and (tg_op = 'INSERT' or new.explanation_as is distinct from old.explanation_as) then
      -- Teacher typed or corrected the Assamese explanation.
      new.explanation_as_status := 'REVIEWED';
      new.explanation_as_error := null;
    elsif tg_op = 'UPDATE' and new.explanation is distinct from old.explanation
          and coalesce(old.explanation_as_status, '') <> 'REVIEWED' then
      -- English changed and the Assamese one was only machine-made: translate again.
      new.explanation_as := null;
      new.explanation_as_status := null;
    end if;
  end if;

  if new.explanation_as is null then
    if new.explanation is null then
      new.explanation_as_status := null;
      new.explanation_as_error := null;
    elsif coalesce(new.explanation_as_status, '') not in ('PENDING', 'FAILED') then
      new.explanation_as_status := 'PENDING';
      new.explanation_as_error := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists mock_qb_explanation_as on public.mock_question_bank;
create trigger mock_qb_explanation_as
  before insert or update of explanation, explanation_as, explanation_as_status, language
  on public.mock_question_bank
  for each row execute function public.mock_qb_explanation_as_trg();

-- -----------------------------------------------------------------------------
-- Existing questions: queue them (or keep Assamese text the teacher already typed).
-- -----------------------------------------------------------------------------
update public.mock_question_bank
   set explanation_as = btrim(explanation), explanation_as_status = 'REVIEWED'
 where upper(coalesce(language, '')) in ('ASSAMESE', 'COMMON')
   and explanation_as is null
   and public.jnvst_has_assamese_script(explanation);

update public.mock_question_bank
   set explanation_as_status = 'PENDING'
 where upper(coalesce(language, '')) in ('ASSAMESE', 'COMMON')
   and explanation_as is null
   and nullif(btrim(coalesce(explanation, '')), '') is not null
   and explanation_as_status is null;

-- -----------------------------------------------------------------------------
-- Student OMR report (replaces the V18 version). Same output plus, per question:
--   explanation     English explanation (current bank text, else the printed copy)
--   explanation_as  Assamese explanation (current bank text, else the printed copy)
--   language        ENGLISH / ASSAMESE / COMMON
-- -----------------------------------------------------------------------------
create or replace function public.student_omr_report(p_paper_base_serial text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  g record;
  v_set text;
  v_rows jsonb;
begin
  if v_uid is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  select upper(set_code) into v_set from public.omr_responses
   where student_id = v_uid and paper_base_serial = p_paper_base_serial limit 1;
  if v_set is null then raise exception 'No OMR result found for this exam.'; end if;

  select * into g from public.jnvst_generated_question_papers p
   where (p.serial_no = p_paper_base_serial or p.serial_no like p_paper_base_serial || '-%')
     and (p.paper_snapshot->>'student_id' = v_uid::text
          or (coalesce(p.paper_snapshot->>'student_id','') = '' and upper(coalesce(p.set_code,'A')) = v_set))
   order by (p.paper_snapshot->>'student_id' = v_uid::text) desc nulls last, p.generated_at desc
   limit 1;
  if not found then raise exception 'The question paper for this result was not found.'; end if;

  select jsonb_agg(jsonb_build_object(
           'no', r.question_no,
           'selected', coalesce(r.selected_option, ''),
           'correct_option', r.correct_option,
           'is_correct', r.is_correct,
           'q', (select jsonb_build_object(
                   'question_text', x->>'question_text', 'option_a', x->>'option_a', 'option_b', x->>'option_b',
                   'option_c', x->>'option_c', 'option_d', x->>'option_d', 'image_url', x->>'image_url',
                   'explanation', coalesce(nullif(btrim(b.explanation), ''), x->>'explanation'),
                   'explanation_as', coalesce(nullif(btrim(b.explanation_as), ''), x->>'explanation_as'),
                   'language', upper(coalesce(b.language, x->>'language', g.language, '')),
                   'topic', x->>'topic', '_partHeading', x->>'_partHeading', '_passageTitle', x->>'_passageTitle',
                   'subject_name', (select sj.name from public.jnvst_subjects sj where sj.id::text = x->>'subject_id' limit 1),
                   'lesson_name', (select coalesce(pl.lesson_name || ' › ', '') || l.lesson_name
                                     from public.jnvst_subject_lessons l
                                     left join public.jnvst_subject_lessons pl on pl.id = l.parent_lesson_id
                                    where l.id::text = x->>'lesson_id' limit 1))
                 from jsonb_array_elements(g.paper_snapshot->'rows') with ordinality t(x, n)
                 left join public.mock_question_bank b on b.id::text = x->>'id'
                 where n = r.question_no)
         ) order by r.question_no)
    into v_rows
  from public.omr_responses r
  where r.student_id = v_uid and r.paper_base_serial = p_paper_base_serial;

  return jsonb_build_object(
    'title', g.title, 'subject', g.subject, 'generated_at', g.generated_at,
    'student_name', (select full_name from public.profiles where id = v_uid),
    'roll_no', (select roll_no from public.profiles where id = v_uid),
    'imported_at', (select max(i.imported_at) from public.omr_imports i
                    join public.omr_responses r2 on r2.import_id = i.id
                    where r2.student_id = v_uid and r2.paper_base_serial = p_paper_base_serial),
    'rows', coalesce(v_rows, '[]'::jsonb));
end;
$$;
revoke all on function public.student_omr_report(text) from public, anon;
grant execute on function public.student_omr_report(text) to authenticated;

select 'V20 Assamese explanations applied' as status,
       (select count(*) from public.mock_question_bank where explanation_as_status = 'PENDING') as queued_for_translation;
