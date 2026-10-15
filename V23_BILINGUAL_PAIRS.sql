-- =============================================================================
-- V23 — Link English and Assamese versions of JNVST questions
-- -----------------------------------------------------------------------------
-- Run ONCE in the Supabase SQL Editor. Safe to re-run. Changes no data by itself.
--
-- Adds one function used by "🌐 Check missing translations" → "Link all …":
-- it links many question pairs in a single request. Without it the page still
-- works, but links the pairs one request at a time (slower for hundreds of pairs).
--
-- Each pair gets its own new language_pair_id. A pair is only linked when both
-- questions belong to the logged-in teacher and are in different languages.
-- =============================================================================

create or replace function public.jnvst_link_language_pairs(p_pairs jsonb)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  r jsonb;
  v_a uuid;
  v_b uuid;
  v_pair uuid;
  n integer := 0;
begin
  for r in select * from jsonb_array_elements(coalesce(p_pairs, '[]'::jsonb)) loop
    v_a := nullif(r->>'a','')::uuid;
    v_b := nullif(r->>'b','')::uuid;
    if v_a is null or v_b is null or v_a = v_b then continue; end if;
    if (select count(distinct upper(coalesce(language,'')))
          from public.mock_question_bank
         where teacher_id = auth.uid() and id in (v_a, v_b)) = 2 then
      v_pair := gen_random_uuid();   -- one id shared by both questions
      update public.mock_question_bank
         set language_pair_id = v_pair
       where teacher_id = auth.uid() and id in (v_a, v_b);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

revoke all on function public.jnvst_link_language_pairs(jsonb) from public;
grant execute on function public.jnvst_link_language_pairs(jsonb) to authenticated;

-- check: select count(*) filter (where language_pair_id is not null) as linked_rows, count(*) as all_rows
--        from public.mock_question_bank where upper(language) in ('ENGLISH','ASSAMESE');
