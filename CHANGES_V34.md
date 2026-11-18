# V34: Correct the OMR answer key without re-importing (and undo an import)

**The problem:** a key in an imported OMR paper was wrong, so the results had to be deleted and imported again.

**Now:** go to Import OMR Results → OMR Import History → **✏️ Correct key / Undo**. Choose the new key (or **Bonus**), click **Preview**, then click **Apply**.
- Every imported student is re-marked from the bubbles saved at import time. No rescanning and no re-import.
- The Mistake Bank and Student Progress (V27 history) are corrected only for the students whose result changes. The result is the same as importing with the right key from the start. This was tested against a real import, including online answers before and after the OMR test.
- **Bonus** takes the question out of every student's result and the Mistake Bank. Later imports of the same paper skip it too.
- The saved answer key and the printed copy (Generated History) get the new key.
- **Also correct the Question Bank** (ticked by default) changes the key in the bank, and in the other-language copy too.
  - With V32 installed, this also re-marks online assignments and mock tests that used the question. The preview shows how many.
  - Admin: can correct their own questions and the Admin's questions.
  - Teacher: can correct their own questions only while they are not yet approved. An approved question is shown as "ask the Admin".
- **Undo the import** (all students, or chosen ones) removes the results from the Mistake Bank and the history, so a corrected sheet can be imported again.
- **⚠ most chose X** marks questions where most students chose another option than the key.
- Only the teacher who generated the paper can open it.

## Files
| File | Change |
|---|---|
| `V34_OMR_KEY_CORRECTION.sql` (also in `supabase/migrations/20261118000001_v34_omr_key_correction.sql`) | **Run once** in Supabase → SQL Editor. Safe to run again. Does not change `teacher_import_omr_results`. |
| `omr-fix.js` | New: the Correct OMR Key page. |
| `teacher-app.js` (v48) | A "Correct" column in OMR Import History. Bonus questions set here are skipped in later imports of the same paper. |
| `main.html` | Loads `teacher-app.js?v=48` and `omr-fix.js?v=2` (after `answer-key-remark.js`). |

**Note:** the first version of this tool was sent as "V25". That number was already used for the Excel result sheet, so this is V34. If you ran that SQL, just run V34: it replaces it and removes the old `v25_*` helper functions.
