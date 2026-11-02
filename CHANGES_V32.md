# V32: Change an answer key → all earlier results are re-marked automatically

## What happens
When you change the **Correct Answer** of a question and save it, from any screen (Question Bank edit, passage edit,
Mock Bank edit, the teacher's question editor, ⬆ Re-upload Edited Excel, or an assignment's ✎ Edit Questions):

1. **First, the app shows you what will change:**
   *"Correct Answer changes: A → B. This question was answered 47 time(s) in 3 assignments and 1 mock test.
   12 answer(s) of 9 student(s) will change between right and wrong …"*
   **OK** = save and re-mark · **Cancel** = nothing is saved.
   If no student's result would change, it simply saves. An Excel re-upload asks once for the whole file.
2. **Then the database re-marks everything by itself:**
   * **Question Bank change:** the new key is copied to every assignment and mock test that uses the question.
   * **Online assignments:** each student's answer is marked right/wrong again and the score is recalculated.
     Results pages, the class analysis, the discussion PDF and Excel exports show the new marks.
   * **Mock tests:** the score, percentage and section results are recalculated.
   * **Mistake Bank / Student progress:** the old result in each student's history is corrected, and the counts,
     last result and "2 correct in a row" are rebuilt. Adaptive assignments use the corrected data.
   * **Changing the key inside one assignment** (✎ Edit Questions) re-marks only that assignment.
   * **OMR imports are NOT changed.** They keep the key used at import, as you chose.
   * A pass (80% or more) that drops below 80% because of a re-mark is **never deleted** by the
     "below 80% → redo after 3 hours" rule. Only new submissions follow that rule.

## Install
1. Supabase → SQL Editor: run **`V32_ANSWER_KEY_REMARK.sql`** once (after V30 and V31). It shows
   `V32 answer-key re-marking installed`. It is safe to run again.
2. Upload **`answer-key-remark.js`** (new), **`jnvst-qb-excel.js`** and **`main.html`**. Press Ctrl+Shift+R.
   (This zip also contains all the other files changed since V29, in case some are not uploaded yet.)

Without the SQL, saving works exactly as before: no message and no re-marking.

## Tested
* **PostgreSQL 16, with the real V14 Mistake Bank function and V27 history log:** 3 students submit an assignment
  and 1 a mock test; the key is changed in the Question Bank. Both copies are updated. Student 1: 2/2 → 1/2, protected
  from the reset. Student 2: 1/2 → 2/2. Student 3 (another option) is unchanged. Mock: 1.25 → 2.50 marks, with
  section results. Mistake Bank: history flipped, and counts, last result and streak rebuilt. A change inside one
  assignment re-marks only that assignment. A student cannot use the impact check. The 80% reset deletes only a
  submission that never passed. The SQL can be run twice.
* **Chromium:** same answer → no question; changed answer → message with the numbers; Cancel → nothing saved;
  OK → saved with a "re-marked" note; nobody affected → saved without asking; assignment Edit Questions; an Excel
  re-upload asks once; without the SQL, saving works as before. No page errors.
