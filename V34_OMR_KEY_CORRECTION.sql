-- =============================================================================
-- V34: Correct the answer key of an imported OMR paper, and undo an OMR import
-- -----------------------------------------------------------------------------
-- Run once in Supabase → SQL Editor (select all → Run). Safe to run again.
-- Needs V14 + V16 (OMR import). Works with V24 (teacher accounts), V27 (Student
-- progress history) and V32 (answer key re-mark) when they are installed.
-- Does NOT change teacher_import_omr_results.
--
-- V32 re-marks online work when a key changes but leaves OMR imports alone.
-- V34 fills that gap:
--  teacher_omr_key_overview(base)                 questions of a paper, keys, how students marked them
--  teacher_omr_change_key(base, changes, fix_bank, dry_run)
--        re-marks every imported student from the bubbles saved at import time
--        (no re-import needed); the Mistake Bank and the V27 progress history are
--        corrected for the students whose result changes. "BONUS" takes the
--        question out of the results. Ticking "also correct the Question Bank"
--        changes the bank key; with V32 installed that also re-marks online
--        assignments and mock tests that used the question.
--  teacher_omr_undo_import(base, student_ids, dry_run)
--        removes imported results (all students or some) from the results,
--        the Mistake Bank and the progress history, so a sheet can be imported again
-- Who may use it: the teacher who generated the paper (Admin or teacher).
-- =============================================================================

create table if not exists public.omr_key_changes (
  id bigserial primary key,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  paper_base_serial text not null,
  mock_question_id uuid,
  old_key text,
  new_key text not null,
  students_changed integer not null default 0,
  bank_updated boolean not null default false,
  changed_at timestamptz not null default now()
);
create index if not exists idx_omr_key_changes_paper on public.omr_key_changes(teacher_id, paper_base_serial);
alter table public.omr_key_changes enable row level security;
drop policy if exists omr_key_changes_teacher_read on public.omr_key_changes;
create policy omr_key_changes_teacher_read on public.omr_key_changes
  for select to authenticated using (teacher_id = auth.uid());

-- -----------------------------------------------------------------------------
-- last_result can be boolean or text with a CHECK (see V14 fix): same rules here.
-- -----------------------------------------------------------------------------
create or replace function public.v34_last_result_value(p_ok boolean, out v_type text, out v_val text)
language plpgsql stable security definer set search_path = public as $$
declare v_def text; m text[];
begin
  select format_type(a.atttypid, a.atttypmod) into v_type
  from pg_attribute a
  where a.attrelid = 'public.student_question_performance'::regclass and a.attname = 'last_result' and not a.attisdropped;
  if v_type = 'boolean' then
    v_val := case when p_ok then 'true' else 'false' end; return;
  end if;
  for v_def in select pg_get_constraintdef(c.oid) from pg_constraint c
               where c.conrelid = 'public.student_question_performance'::regclass and c.contype = 'c'
                 and pg_get_constraintdef(c.oid) like '%last_result%'
  loop
    for m in select regexp_matches(v_def, '''([^'']*)''', 'g') loop
      if p_ok and lower(m[1]) in ('correct','right','true','t','1','yes','y','pass','passed','ok') then v_val := m[1];
      elsif (not p_ok) and lower(m[1]) in ('wrong','incorrect','false','f','0','no','n','fail','failed','mistake') then v_val := m[1];
      end if;
    end loop;
  end loop;
  if v_val is null and not exists (select 1 from pg_constraint c
       where c.conrelid = 'public.student_question_performance'::regclass and c.contype = 'c'
         and pg_get_constraintdef(c.oid) like '%last_result%') then
    v_val := case when p_ok then 'CORRECT' else 'WRONG' end;
  end if;
end;
$$;
revoke all on function public.v34_last_result_value(boolean) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Change one OMR result in the Mistake Bank.
--   p_old_ok  result counted at import time
--   p_new_ok  new result; NULL = take the result out completely (undo / bonus)
--   p_at      time of that import
-- Counts are exact. "Last result" changes only when this import is still the
-- student's latest attempt at the question. The streak is exact unless the student
-- has a newer wrong answer on the question (then it is left as it is).
-- -----------------------------------------------------------------------------
create or replace function public.v34_adjust_counts(p_student uuid, p_qid uuid, p_old_ok boolean, p_new_ok boolean, p_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.student_question_performance%rowtype;
  v_latest boolean; v_no_later_wrong boolean; v_type text; v_val text; v_last boolean;
begin
  if p_student is null or p_qid is null then return; end if;
  if p_new_ok is not null and p_new_ok = p_old_ok then return; end if;
  select * into r from public.student_question_performance
   where student_id = p_student and mock_question_id = p_qid for update;
  if not found then return; end if;
  v_latest := r.last_attempted_at is null or r.last_attempted_at <= p_at + interval '1 second';
  -- no wrong answer after this import: the current streak runs back to this import
  v_no_later_wrong := r.last_wrong_at is null or r.last_wrong_at <= p_at + interval '1 second';

  if p_new_ok is null then
    -- take the result out
    r.attempt_count := greatest(r.attempt_count - 1, 0);
    if p_old_ok then
      r.correct_count := greatest(r.correct_count - 1, 0);
      if v_no_later_wrong then r.correct_streak := greatest(coalesce(r.correct_streak,0) - 1, 0); end if;
    else
      r.wrong_count := greatest(r.wrong_count - 1, 0);
    end if;
    if r.attempt_count = 0 then
      delete from public.student_question_performance where id = r.id;
      return;
    end if;
    -- the result before this import: a streak means the last answer was correct;
    -- otherwise only the counts can tell (all wrong / all correct)
    if v_latest then
      v_last := case when p_old_ok then coalesce(r.correct_streak,0) > 0
                     when r.correct_count = 0 then false
                     when r.wrong_count = 0 then true
                     else null end;
    end if;
  elsif p_new_ok then
    -- wrong → correct
    r.wrong_count := greatest(r.wrong_count - 1, 0);
    r.correct_count := r.correct_count + 1;
    r.last_correct_at := greatest(coalesce(r.last_correct_at, p_at), p_at);
    if v_latest or v_no_later_wrong then r.correct_streak := coalesce(r.correct_streak,0) + 1; end if;
  else
    -- correct → wrong
    r.correct_count := greatest(r.correct_count - 1, 0);
    r.wrong_count := r.wrong_count + 1;
    r.first_wrong_at := least(coalesce(r.first_wrong_at, p_at), p_at);
    r.last_wrong_at := greatest(coalesce(r.last_wrong_at, p_at), p_at);
    r.correct_streak := case when v_latest then 0
                             when v_no_later_wrong then greatest(coalesce(r.correct_streak,0) - 1, 0)
                             else r.correct_streak end;
  end if;
  if r.wrong_count = 0 then r.first_wrong_at := null; r.last_wrong_at := null; end if;

  update public.student_question_performance
     set attempt_count = r.attempt_count, wrong_count = r.wrong_count, correct_count = r.correct_count,
         first_wrong_at = r.first_wrong_at, last_wrong_at = r.last_wrong_at, last_correct_at = r.last_correct_at,
         correct_streak = r.correct_streak, updated_at = now()
   where id = r.id;

  if v_latest and p_new_ok is not null then v_last := p_new_ok; end if;
  if v_latest and v_last is not null then
    select x.v_type, x.v_val into v_type, v_val from public.v34_last_result_value(v_last) x;
    if v_val is not null then
      execute format('update public.student_question_performance set last_result = $1::%s where id = $2', v_type)
        using v_val, r.id;
    end if;
  end if;
end;
$$;
revoke all on function public.v34_adjust_counts(uuid, uuid, boolean, boolean, timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- One OMR result changed (p_new_ok) or taken out (p_new_ok NULL).
-- 1. counts are corrected (always works, also without V27);
-- 2. with V27: the logged OMR answer is changed / deleted in the progress history;
--    when the history holds every answer of the student on this question, the
--    Mistake Bank row is rebuilt from it, so streak and last result are exact.
-- -----------------------------------------------------------------------------
create or replace function public.v34_omr_result_fix(p_student uuid, p_qid uuid, p_old_ok boolean, p_new_ok boolean, p_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_ev bigint; v_total int; p record;
  v_wrong int; v_right int; v_last boolean; v_src text; v_streak int; v_type text; v_val text;
  v_first_wrong timestamptz; v_last_wrong timestamptz; v_last_right timestamptz; v_last_at timestamptz;
begin
  if p_student is null or p_qid is null then return; end if;
  if p_new_ok is not null and p_new_ok = p_old_ok then return; end if;

  perform public.v34_adjust_counts(p_student, p_qid, p_old_ok, p_new_ok, p_at);

  if to_regclass('public.student_question_events') is null then return; end if;
  select id into v_ev from public.student_question_events
   where student_id = p_student and mock_question_id = p_qid
     and upper(coalesce(source, '')) = 'OMR' and is_correct = p_old_ok
     and at between p_at - interval '2 seconds' and p_at + interval '2 seconds'
   order by abs(extract(epoch from (at - p_at))), id limit 1;
  if v_ev is null then return; end if;

  if p_new_ok is null then
    delete from public.student_question_events where id = v_ev;
  else
    update public.student_question_events set is_correct = p_new_ok where id = v_ev;
  end if;
  -- "wrong before" of every answer of this student on this question
  update public.student_question_events e set wrong_before = x.wb
    from (select id, coalesce(sum(case when is_correct then 0 else 1 end)
                   over (order by at, id rows between unbounded preceding and 1 preceding), 0) as wb
            from public.student_question_events where student_id = p_student and mock_question_id = p_qid) x
   where e.id = x.id and e.wrong_before is distinct from x.wb;

  select * into p from public.student_question_performance where student_id = p_student and mock_question_id = p_qid;
  if not found then return; end if;
  select count(*) into v_total from public.student_question_events where student_id = p_student and mock_question_id = p_qid;
  if v_total = 0 or v_total <> coalesce(p.attempt_count, 0) then return; end if;  -- older answers not logged: counts are enough

  select count(*) filter (where not is_correct), count(*) filter (where is_correct),
         min(at) filter (where not is_correct), max(at) filter (where not is_correct), max(at) filter (where is_correct), max(at)
    into v_wrong, v_right, v_first_wrong, v_last_wrong, v_last_right, v_last_at
    from public.student_question_events where student_id = p_student and mock_question_id = p_qid;
  select is_correct, source into v_last, v_src from public.student_question_events
   where student_id = p_student and mock_question_id = p_qid order by at desc, id desc limit 1;
  select count(*) into v_streak from (
    select is_correct, row_number() over (order by at desc, id desc) rn
      from public.student_question_events where student_id = p_student and mock_question_id = p_qid) s
   where s.rn < coalesce((select min(rn) from (select is_correct, row_number() over (order by at desc, id desc) rn
                            from public.student_question_events where student_id = p_student and mock_question_id = p_qid) t
                          where not t.is_correct), 2147483647);
  update public.student_question_performance set
    wrong_count = v_wrong, correct_count = v_right,
    first_wrong_at = v_first_wrong, last_wrong_at = v_last_wrong, last_correct_at = v_last_right,
    last_attempted_at = v_last_at, last_source = coalesce(v_src, last_source),
    correct_streak = v_streak, updated_at = now()
   where id = p.id;
  select x.v_type, x.v_val into v_type, v_val from public.v34_last_result_value(v_last) x;
  if v_val is not null then
    execute format('update public.student_question_performance set last_result = $1::%s where id = $2', v_type)
      using v_val, p.id;
  end if;
end;
$$;
revoke all on function public.v34_omr_result_fix(uuid, uuid, boolean, boolean, timestamptz) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- May this teacher change the Question Bank key of a question?
--   mine            yes
--   approved_locked a teacher's question already approved by the Admin (V24): ask the Admin
--   not_yours       a question of the Admin / another teacher
--   deleted         no longer in the bank
-- -----------------------------------------------------------------------------
create or replace function public.v34_bank_status(p_qid uuid, p_uid uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare b jsonb; v_admin boolean := false; v_limited boolean := false;
begin
  select to_jsonb(q) into b from public.mock_question_bank q where q.id = p_qid;
  if b is null then return 'deleted'; end if;
  if to_regprocedure('public.v24_is_limited_teacher()') is not null then
    select coalesce(bool_or(is_admin), false) into v_admin
      from (select (to_jsonb(pr)->>'is_admin')::boolean as is_admin from public.profiles pr where pr.id = p_uid) z;
    v_limited := not v_admin and exists (select 1 from public.profiles pr where pr.id = p_uid and (to_jsonb(pr) ? 'is_admin'));
  end if;
  if (b->>'teacher_id')::uuid = p_uid then
    if v_limited and coalesce(b->>'approval_status', '') = 'approved' then return 'approved_locked'; end if;
    return 'mine';
  end if;
  if v_admin then
    execute 'select $1 = any (public.v24_admin_ids())' into v_admin using (b->>'teacher_id')::uuid;
    if v_admin then return 'mine'; end if;
  end if;
  return 'not_yours';
end;
$$;
revoke all on function public.v34_bank_status(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Only the teacher who generated the paper may change it.
-- -----------------------------------------------------------------------------
create or replace function public.v34_check_paper(p_base text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid and lower(coalesce(role,'')) = 'teacher') then
    raise exception 'Only teachers can change OMR results.' using errcode = '42501';
  end if;
  if coalesce(trim(p_base),'') = '' or not exists (
       select 1 from public.jnvst_generated_question_papers
        where teacher_id = v_uid and (serial_no = p_base or serial_no like p_base || '-%')) then
    raise exception 'Question paper % was not found in your Generated Question Paper history.', p_base;
  end if;
  return v_uid;
end;
$$;
revoke all on function public.v34_check_paper(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Overview: every question of the paper, its key, where it is, how students marked it
-- -----------------------------------------------------------------------------
create or replace function public.teacher_omr_key_overview(p_paper_base_serial text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid; v jsonb;
begin
  v_uid := public.v34_check_paper(p_paper_base_serial);
  with papers as (
    select g.id, g.serial_no, g.set_code, g.title, g.subject, g.generated_at,
           nullif(g.paper_snapshot->>'student_id','') as student_id,
           coalesce(g.answer_key_snapshot->'rows','[]'::jsonb) as keys
      from public.jnvst_generated_question_papers g
     where g.teacher_id = v_uid and (g.serial_no = p_paper_base_serial or g.serial_no like p_paper_base_serial || '-%')
  ), keyrows as (
    select p.id as paper_id, p.set_code, p.student_id, (x->>'Q.No.')::int as qno,
           nullif(x->>'Question ID','')::uuid as qid, upper(trim(coalesce(x->>'Correct Option',''))) as key,
           coalesce((x->>'Bonus')::boolean, false) as bonus
      from papers p, jsonb_array_elements(p.keys) x
     where nullif(x->>'Question ID','') is not null
  ), q as (
    select k.qid,
           min(k.qno) as first_qno,
           jsonb_agg(distinct jsonb_build_object('set', k.set_code, 'qno', k.qno)) filter (where k.student_id is null) as positions,
           count(*) filter (where k.student_id is not null) as personal_papers,
           array_agg(distinct k.key) as keys,
           bool_or(k.bonus) as bonus
      from keyrows k group by k.qid
  ), marks as (
    select r.mock_question_id as qid,
           count(*) as answered,
           count(*) filter (where r.is_correct) as correct,
           count(*) filter (where upper(trim(coalesce(r.selected_option,''))) = 'A') as a,
           count(*) filter (where upper(trim(coalesce(r.selected_option,''))) = 'B') as b,
           count(*) filter (where upper(trim(coalesce(r.selected_option,''))) = 'C') as c,
           count(*) filter (where upper(trim(coalesce(r.selected_option,''))) = 'D') as d,
           count(*) filter (where trim(coalesce(r.selected_option,'')) = '') as blank,
           count(*) filter (where trim(coalesce(r.selected_option,'')) <> '' and upper(trim(r.selected_option)) !~ '^[ABCD]$') as multi
      from public.omr_responses r
     where r.paper_base_serial = p_paper_base_serial
     group by r.mock_question_id
  )
  select jsonb_build_object(
    'base', p_paper_base_serial,
    'title', (select max(title) from papers),
    'subject', (select max(subject) from papers),
    'personal', exists (select 1 from papers where student_id is not null),
    'papers', (select count(*) from papers),
    'students_imported', (select count(distinct student_id) from public.omr_responses where paper_base_serial = p_paper_base_serial),
    'imports', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'imported_at', i.imported_at, 'exam_title', i.exam_title, 'file_name', i.file_name, 'students', i.student_count) order by i.imported_at)
                           from public.omr_imports i where i.teacher_id = v_uid and i.paper_base_serial = p_paper_base_serial), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', s.student_id, 'roll_no', pr.roll_no, 'name', pr.full_name, 'set_code', s.set_code) order by pr.roll_no)
                           from (select distinct student_id, set_code from public.omr_responses where paper_base_serial = p_paper_base_serial) s
                           join public.profiles pr on pr.id = s.student_id), '[]'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
        'question_id', q.qid, 'first_qno', q.first_qno, 'positions', coalesce(q.positions,'[]'::jsonb), 'personal_papers', q.personal_papers,
        'keys', to_jsonb(q.keys), 'bonus', q.bonus,
        'bank_key', upper(trim(coalesce(b.correct_option,''))), 'bank_mine', (public.v34_bank_status(q.qid, v_uid) = 'mine'), 'bank_status', public.v34_bank_status(q.qid, v_uid),
        'v32', (to_regprocedure('public.v32_bank_key_trg()') is not null),
        'question_text', left(coalesce(b.question_text,''), 400), 'image_url', b.image_url,
        'option_a', left(coalesce(b.option_a,''),120), 'option_b', left(coalesce(b.option_b,''),120),
        'option_c', left(coalesce(b.option_c,''),120), 'option_d', left(coalesce(b.option_d,''),120),
        'passage_title', b.passage_title,
        'answered', coalesce(m.answered,0), 'correct', coalesce(m.correct,0),
        'marks', jsonb_build_object('A',coalesce(m.a,0),'B',coalesce(m.b,0),'C',coalesce(m.c,0),'D',coalesce(m.d,0),'blank',coalesce(m.blank,0),'multi',coalesce(m.multi,0)))
        order by q.first_qno, q.qid)
      from q left join public.mock_question_bank b on b.id = q.qid left join marks m on m.qid = q.qid), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('question_id', c.mock_question_id, 'old_key', c.old_key, 'new_key', c.new_key,
                          'students_changed', c.students_changed, 'bank_updated', c.bank_updated, 'changed_at', c.changed_at) order by c.changed_at)
                         from public.omr_key_changes c where c.teacher_id = v_uid and c.paper_base_serial = p_paper_base_serial), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;
revoke all on function public.teacher_omr_key_overview(text) from public;
grant execute on function public.teacher_omr_key_overview(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Change keys and re-mark.  p_changes = [{"question_id": "...", "new_key": "A"|"B"|"C"|"D"|"BONUS"}]
-- -----------------------------------------------------------------------------
create or replace function public.teacher_omr_change_key(
  p_paper_base_serial text, p_changes jsonb, p_fix_bank boolean default true, p_dry_run boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_uid uuid; c jsonb; v_qid uuid; v_new text; v_old text;
  r record; v_ok boolean;
  v_to_ok int; v_to_wrong int; v_removed int; v_total int; v_students int;
  v_bank text; v_pair uuid; v_has_pair boolean; v_owner uuid; v_online jsonb;
  v_report jsonb := '[]'::jsonb;
begin
  v_uid := public.v34_check_paper(p_paper_base_serial);
  select exists (select 1 from pg_attribute where attrelid = 'public.mock_question_bank'::regclass
                  and attname = 'language_pair_id' and not attisdropped) into v_has_pair;

  for c in select * from jsonb_array_elements(coalesce(p_changes,'[]'::jsonb)) loop
    v_qid := nullif(c->>'question_id','')::uuid;
    v_new := upper(trim(coalesce(c->>'new_key','')));
    if v_qid is null then continue; end if;
    if v_new not in ('A','B','C','D','BONUS') then
      raise exception 'New key must be A, B, C, D or BONUS (got %).', v_new;
    end if;

    select string_agg(distinct upper(trim(x->>'Correct Option')), '/') into v_old
      from public.jnvst_generated_question_papers g, jsonb_array_elements(coalesce(g.answer_key_snapshot->'rows','[]'::jsonb)) x
     where g.teacher_id = v_uid and (g.serial_no = p_paper_base_serial or g.serial_no like p_paper_base_serial || '-%')
       and x->>'Question ID' = v_qid::text;
    if v_old is null then
      raise exception 'Question % is not in paper %.', v_qid, p_paper_base_serial;
    end if;

    v_to_ok := 0; v_to_wrong := 0; v_removed := 0; v_total := 0;
    for r in select o.id, o.student_id, o.selected_option, o.is_correct, i.imported_at
               from public.omr_responses o join public.omr_imports i on i.id = o.import_id
              where o.paper_base_serial = p_paper_base_serial and o.mock_question_id = v_qid and i.teacher_id = v_uid
              for update of o
    loop
      v_total := v_total + 1;
      if v_new = 'BONUS' then
        v_removed := v_removed + 1;
        if not p_dry_run then
          perform public.v34_omr_result_fix(r.student_id, v_qid, r.is_correct, null, r.imported_at);
          delete from public.omr_responses where id = r.id;
        end if;
        continue;
      end if;
      v_ok := upper(trim(coalesce(r.selected_option,''))) ~ '^[ABCD]$' and upper(trim(r.selected_option)) = v_new;
      if v_ok and not r.is_correct then v_to_ok := v_to_ok + 1;
      elsif (not v_ok) and r.is_correct then v_to_wrong := v_to_wrong + 1; end if;
      if not p_dry_run then
        if v_ok <> r.is_correct then
          perform public.v34_omr_result_fix(r.student_id, v_qid, r.is_correct, v_ok, r.imported_at);
        end if;
        update public.omr_responses set is_correct = v_ok, correct_option = v_new where id = r.id;
      end if;
    end loop;
    v_students := v_to_ok + v_to_wrong + v_removed;

    -- question bank (only questions that belong to this teacher; also the other-language copy)
    v_bank := 'not_changed'; v_online := null;
    if v_new <> 'BONUS' and p_fix_bank then
      v_bank := public.v34_bank_status(v_qid, v_uid);
      if v_bank = 'mine' then
        v_bank := 'updated';
        -- V32: online assignments / mock tests that used this question are re-marked too
        if to_regprocedure('public.v32_answer_key_impact(text, uuid[], text)') is not null then
          begin
            execute 'select public.v32_answer_key_impact($1, $2, $3)' into v_online using 'mock_question_bank', array[v_qid], v_new;
          exception when others then v_online := null;
          end;
        end if;
        if not p_dry_run then
          v_owner := (select teacher_id from public.mock_question_bank where id = v_qid);
          update public.mock_question_bank set correct_option = v_new where id = v_qid;
          if v_has_pair then
            execute 'select language_pair_id from public.mock_question_bank where id = $1' into v_pair using v_qid;
            if v_pair is not null then
              execute 'update public.mock_question_bank set correct_option = $1 where teacher_id = $2 and id <> $3 and (language_pair_id = $4 or id = $4)'
                using v_new, v_owner, v_qid, v_pair;
            end if;
          end if;
        end if;
      end if;
    end if;

    if not p_dry_run then
      -- the saved answer keys (all sets / personal papers of this batch) and the printed copy
      update public.jnvst_generated_question_papers g
         set answer_key_snapshot = jsonb_set(g.answer_key_snapshot, '{rows}',
               (select jsonb_agg(case when x->>'Question ID' = v_qid::text then
                         case when v_new = 'BONUS' then x || jsonb_build_object('Bonus', true)
                              else (x - 'Bonus') || jsonb_build_object('Correct Option', v_new) end
                       else x end order by n)
                  from jsonb_array_elements(g.answer_key_snapshot->'rows') with ordinality t(x, n))),
             paper_snapshot = case when v_new = 'BONUS' or jsonb_typeof(g.paper_snapshot->'rows') <> 'array' then g.paper_snapshot
               else jsonb_set(g.paper_snapshot, '{rows}',
                 (select jsonb_agg(case when x->>'id' = v_qid::text then x || jsonb_build_object('correct_option', v_new) else x end order by n)
                    from jsonb_array_elements(g.paper_snapshot->'rows') with ordinality t(x, n))) end
       where g.teacher_id = v_uid and (g.serial_no = p_paper_base_serial or g.serial_no like p_paper_base_serial || '-%')
         and exists (select 1 from jsonb_array_elements(coalesce(g.answer_key_snapshot->'rows','[]'::jsonb)) x where x->>'Question ID' = v_qid::text);

      insert into public.omr_key_changes(teacher_id, paper_base_serial, mock_question_id, old_key, new_key, students_changed, bank_updated)
      values (v_uid, p_paper_base_serial, v_qid, v_old, v_new, v_students, v_bank = 'updated');
    end if;

    v_report := v_report || jsonb_build_object('question_id', v_qid, 'old_key', v_old, 'new_key', v_new,
                  'responses', v_total, 'to_correct', v_to_ok, 'to_wrong', v_to_wrong, 'removed', v_removed, 'bank', v_bank, 'online', v_online);
  end loop;

  return jsonb_build_object('dry_run', p_dry_run, 'changes', v_report);
end;
$$;
revoke all on function public.teacher_omr_change_key(text, jsonb, boolean, boolean) from public;
grant execute on function public.teacher_omr_change_key(text, jsonb, boolean, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Undo an import: all students of the paper (p_student_ids NULL) or some students.
-- -----------------------------------------------------------------------------
create or replace function public.teacher_omr_undo_import(
  p_paper_base_serial text, p_student_ids uuid[] default null, p_dry_run boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid; r record; v_resp int := 0; v_students int;
begin
  v_uid := public.v34_check_paper(p_paper_base_serial);
  select count(distinct o.student_id) into v_students
    from public.omr_responses o join public.omr_imports i on i.id = o.import_id
   where o.paper_base_serial = p_paper_base_serial and i.teacher_id = v_uid
     and (p_student_ids is null or o.student_id = any(p_student_ids));
  for r in select o.id, o.student_id, o.mock_question_id, o.is_correct, i.imported_at
             from public.omr_responses o join public.omr_imports i on i.id = o.import_id
            where o.paper_base_serial = p_paper_base_serial and i.teacher_id = v_uid
              and (p_student_ids is null or o.student_id = any(p_student_ids))
            for update of o
  loop
    v_resp := v_resp + 1;
    if not p_dry_run then
      perform public.v34_omr_result_fix(r.student_id, r.mock_question_id, r.is_correct, null, r.imported_at);
      delete from public.omr_responses where id = r.id;
    end if;
  end loop;
  if not p_dry_run then
    -- imports with nothing left are removed; the others get their student count again
    delete from public.omr_imports i where i.teacher_id = v_uid and i.paper_base_serial = p_paper_base_serial
       and not exists (select 1 from public.omr_responses o where o.import_id = i.id);
    update public.omr_imports i set student_count = (select count(distinct o.student_id) from public.omr_responses o where o.import_id = i.id)
     where i.teacher_id = v_uid and i.paper_base_serial = p_paper_base_serial;
  end if;
  return jsonb_build_object('dry_run', p_dry_run, 'students', v_students, 'responses', v_resp);
end;
$$;
revoke all on function public.teacher_omr_undo_import(text, uuid[], boolean) from public;
grant execute on function public.teacher_omr_undo_import(text, uuid[], boolean) to authenticated;



-- The first version of this tool (shared as "V25") used v25_* helper names.
drop function if exists public.v25_adjust_result(uuid, uuid, boolean, boolean, timestamptz);
drop function if exists public.v25_last_result_value(boolean);
drop function if exists public.v25_check_paper(text);

notify pgrst, 'reload schema';
select 'V34 OMR key correction and undo import installed' as status;
