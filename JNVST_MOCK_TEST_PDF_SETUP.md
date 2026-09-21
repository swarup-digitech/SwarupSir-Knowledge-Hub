# JNVST Mock Test Question Paper PDF

## What was added

The Mock Test module now includes a **JNVST-style Question Paper PDF/Print generator**.

From **Previous Mock Tests**, click:

**🖨 Question Paper PDF**

The generator loads the exact questions stored in the generated Mock Test and opens a print-ready A4 question paper. In the browser print dialog choose **Save as PDF**.

## Current paper structure

- Section I – Part 1: Mental Ability – 20 questions
  - 5 figure-type groups × 4 questions
  - Uses the directions associated with the old JNVST figure types.
- Section I – Part 2: EVS – 20 questions
  - 15 standalone MCQs
  - 1 complete passage
  - 5 passage-based MCQs
- Section II – Arithmetic – 20 questions
- Section III – Language – 20 questions
  - 4 passages × 5 questions
- Final rough-work page.

## Passage handling

For EVS and Language, the passage is printed **once immediately before its associated questions**. The passage metadata is read from the generated Mock Test rows, so the printed paper matches the online test.

## Important

This is a **JNVST-style mock paper**, not an official JNVST question paper. The old uploaded paper is used as the visual/structural reference.

## Browser PDF generation

The implementation is client-side and does not require a new Supabase table or Edge Function.

If the browser blocks the print window, allow pop-ups for the Knowledge Hub site.

## Supabase changes

No database migration is required for this PDF feature because it uses the existing:

- `mock_tests`
- `mock_test_questions`

tables.
