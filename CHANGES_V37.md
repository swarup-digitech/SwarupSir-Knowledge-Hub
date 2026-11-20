# V37: Online / Pen-paper Mock Tests and OMR import into the Mistake Bank

Includes everything from V36 (slot picker, random MAT blocks, series A–D, directions, no “[IMAGE QUESTION]”, no blank pages).

## V37.1 (latest change)
* Generate Test now **starts with the question “Is this Mock Test Online or Pen-paper?”** (top of the page).
* **Online = one paper for everyone.** No separate question sets are made. (The MAT blocks are still in random order, and the 4 questions inside a block are still shuffled, once, for that one paper.)
* The **question sets A–D** drop-down appears **only for Pen-paper** tests.

## What is new
1. **Question when you prepare a Mock Test** (Mock Test Management → Generate Test):
   * **Online** — as before: assign to classes/students, they take it in the app.
   * **Pen-paper** — printed paper + OMR sheet. The Assign To part disappears, no student gets the test, nothing shows on student screens. Each series (A–D) is saved as its own test, tied together by a hidden group id.
   * This is the answer to “don't count twice”: a test is either online or offline, so the same exam can never reach the Mistake Bank by both ways.
2. **Import OMR for an pen-paper test.** Mock Test Management → previous Mock Tests: pen-paper tests show a teal **📄 PEN-PAPER · OMR** badge and a **📥 Import OMR** button (instead of *Approve Results*).
   * Upload the same OMR software Excel as before (Roll No, **Exam Set** A–D, Q n Options, Q n Key, Q n Marks).
   * Every student is marked against the **saved key of his/her series**; mistakes go into the Mistake Bank (source “OMR”), so *Most Missed Questions* and the 60% adaptive assignments see them.
   * If Exam Set is empty, the series is found by comparing the key column (or the answers) with the saved keys.
   * Rules as in the old OMR import: blank and multiple marks = mistake; bonus questions (marks given although the answer ≠ key) and questions whose key was changed in the OMR software are skipped; absent students skipped; a student already imported for this test is skipped; Roll No must belong to one of your classes.
   * **Check (nothing is saved)** first, then **Import into Mistake Bank**.
3. The old *Import OMR Results* page no longer lists these imports (its “Class discussion PDF” button needs a Question Paper Generator paper).

## Install
| File | What to do |
|---|---|
| `V37_MOCK_OFFLINE_OMR.sql` (also in `supabase/migrations/`) | **Run once** in Supabase → SQL Editor. Safe to run again. Needs V14 and V16. Adds 3 columns to `mock_tests` and the function `teacher_import_mock_omr_results`. |
| `main.html`, `teacher-app.js` (v52) | Upload (replace). |

Then Ctrl+Shift+R. **Online tests work even before the SQL is run**; Pen-paper needs it (the app tells you).

## Tested (headless Chrome, sample bank, fake Supabase)
Pen-paper mode hides Assign To and changes the button; offline creation makes one test per series with `delivery_mode/series_group_id/series_code`, no student rows; online creation sends no new columns; the test list shows the badges and buttons; the OMR page reads a sample sheet: set taken from Exam Set, one student without Exam Set found by key, bonus mark flagged, payload sent to the function.
**Not tested:** the SQL function against a real Supabase database, a real OMR Excel file, or the Excel upload itself (the sheet was fed to the same reader the old import uses). Please import one real file with “Check” first.

## Not included yet
Class discussion PDF after a mock OMR import (the old one works from Question Paper Generator papers). Tell me if you want it.
