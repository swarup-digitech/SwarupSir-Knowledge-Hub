# JNVST Mock Test V2

## Implemented

- MAT remains five independent banks, 4 questions per set.
- EVS has 15 independent MCQs plus complete 5-question passage groups.
- Arithmetic accepts either Excel (20-question multiples) or PDF + Answer Key (20-page multiples).
- Language is now one generic passage bank. Each passage is identified by its own Passage ID and contains exactly 5 questions. Any four complete passage groups are used for a 20-question Language section.
- Stable Set IDs are supported for reusable sets.
- PDF pages are cropped to remove unnecessary white space before image upload.
- Bulk upload validates multiples, answer keys and passage group sizes.
- Active duplicate text/options are skipped during Excel upload.
- Existing generated mock tests remain snapshots because their questions are copied into `mock_test_questions`.
- Existing assignment retry/submission rules are not changed.

## Supabase migration

Run:

`jnvst_mock_test_v2_migration.sql`

after your existing Mock Test migration (`mock_test.sql` or `mock_question_bank_migration.sql`).

The migration is safe to rerun. It also converts old `LANG_P1`–`LANG_P4` bank rows to `LANGUAGE_PASSAGE` while preserving their Passage IDs.

## Excel format

### Questions sheet

| Section | Part | Set ID | Passage ID | Question Order | Question | A | B | C | D | Answer | Image URL |
|---|---|---|---|---:|---|---|---|---|---|---|---|
| EVS | EVS_MCQ | EVS-MCQ-001 | | 1 | ... | ... | ... | ... | ... | B | |
| EVS | EVS_PASSAGE | | EVS-P001 | 1 | ... | ... | ... | ... | ... | A | |
| LANGUAGE | LANGUAGE_PASSAGE | | L001 | 1 | ... | ... | ... | ... | ... | C | |
| ARITHMETIC | ARITHMETIC | AR-001 | | 1 | ... | ... | ... | ... | ... | D | |

### Passages sheet

`Passage ID | Passage Title | Passage`

A Language passage should have exactly 5 question rows with the same Passage ID.

## Test blueprint

- MAT: 5 × 4 = 20
- EVS: 15 + 5 = 20
- Arithmetic: 20
- Language: 4 × 5 = 20
- Total: 80 questions, 100 marks, 2 hours

## Upload examples

- MAT Pattern: 4, 8, 12, 16... PDF pages.
- MAT Series: 4, 8, 12, 16... PDF pages.
- MAT Geometrical: 4, 8, 12, 16... PDF pages.
- MAT Mirror & Water: 4, 8, 12, 16... PDF pages.
- MAT Embedded: 4, 8, 12, 16... PDF pages.
- EVS MCQ: 15, 30, 45... Excel rows.
- EVS passages: 5, 10, 15... rows, grouped by Passage ID.
- Arithmetic: 20, 40, 60... Excel rows OR PDF pages + matching answer key.
- Language: 5, 10, 15... rows, grouped by Passage ID.
