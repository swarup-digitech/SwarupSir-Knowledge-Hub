# V17 — Individual OMR sheets, scanning, result PDFs, Mistake Bank

For the personal (Custom Adaptive) papers of V16. Each student gets an OMR sheet that carries a hidden code (which paper, which student). You photograph or scan the filled sheets; the app reads them, you check doubtful ones, import, and every student gets a result PDF. Wrong answers go to the Mistake Bank automatically.

## Install
1. Upload: `omr-engine.js` (new), `custom-omr.js` (new), `student-omr.js` (new), `teacher-app.js`, `main.html`.
2. Supabase → SQL Editor → run **`V17_STUDENT_OMR_REPORTS.sql`** (after V14 and V16). Safe to re-run. (Same as `supabase/migrations/20261012000002_v17_student_omr_reports.sql`.)
3. Reload the page once.

## Teacher: how to use
Mock Test Management → **Custom OMR** (or the button on a "Personalised" batch in Generated History).
1. **Print sheets** – choose the size:
   * **Two sheets on one A4 page** (default for papers up to 40 questions): cut or tear along the dashed line; each half has its own corner squares and code, with 24 mm of clear space around the cut.
   * **One sheet per A4 page** (up to 100 questions).
   Print at **100% / Actual size**, not "fit to page". A blank test sheet is available for a trial.
2. **Scan & import** – choose photos or PDFs (many at once). Each sheet is recognised by its code, even if rotated or tilted. For two-per-page sheets, photograph each torn half, or the whole page before tearing (both sheets are read). Marks that are doubtful (two bubbles, very faint, unclear) are flagged with a picture of the row; correct them in the list. Then Import: first a dry run, then confirm.
3. **Result reports** – print or save all students' result PDFs in one go.

## Student
Student app → OMR result area → **My scanned OMR exams** → Download result PDF (own results only). Wrong answers are already in their Mistake Bank and come back in the next practice.

## Limits (please read)
* Tested on simulated phone photos (tilt, perspective, rotation, shadow, blur, noise), not yet on real phones/printers. **Try 2–3 test sheets first.**
* Version 2 of the engine/screen files (`omr-engine.js?v=2`, `custom-omr.js?v=2`) adds the two-per-page size.
* All four black corner squares must be inside the photo; if one is cut off the sheet is rejected (retake).
* Use a dark pen/pencil, fill the bubble fully. Light ticks are flagged.
* PDFs are read with pdf.js from a CDN (needs internet).
* Only Personalised (V16) batches; School Course not included. The old "OMR Test Result" PDF for students stays.

## Past personal papers & delete (update)
* Every personal paper stays in Generated History; the list now loads **all** saved papers (before, only the latest 1500).
* Custom Adaptive Papers → **📚 Past personal papers, OMR & delete** (also Custom OMR in Mock Test Management) lists every batch with "N of M scanned".
* **Delete** is offered only for papers whose OMR sheet is **not imported yet**: *Delete batch* (nothing scanned), *Delete not-scanned (k)* (mixed batch), or the 🗑 beside one student inside the batch. Papers with imported results are never deleted. The check is repeated against the database right before deleting.
* Deleting a not-scanned paper also frees its questions for that student's next paper.
* New file versions: upload `teacher-app.js`, `main.html`, `custom-adaptive-paper.js`, `omr-engine.js`, `custom-omr.js`, `student-omr.js`.

## Back button (update)
* Header **← Back** now goes to the previous screen of the app. Before, it used the browser's previous page, which could be the login page (so it looked like a logout). The phone/browser Back button does the same.
* **Back is hidden on the home screens** (Teacher dashboard, Student dashboard); Home / Logout buttons are unchanged.
* If a screen cannot be reopened, Back takes you to the home screen.

## "Two sheets per page not showing?"
Open Custom OMR → a batch: under the title it must say **OMR tools version 17.4**. If it says "old" or shows no version, the browser is using an old `omr-engine.js` / `custom-omr.js`: upload **all** files (including `main.html`) and press Ctrl+Shift+R. The Print card must show the two radio buttons ("Two sheets on one A4 page" / "One sheet per A4 page").

## Result report & student dashboard (update, V18 SQL)
* **Student dashboard:** the old "OMR Test Result" card is gone. The dashboard now has only **My scanned OMR exams** (list of scanned exams with score and ⬇ Download result PDF; a friendly message when there are none).
* **Result report:** "Part-wise performance" is replaced by **Performance by subject and topic**: each subject (e.g. Arithmetic, Mental Ability) with its score, then under it the part (MAT/EVS/Language) or lesson/chapter, with the topics covered and a small progress bar.
* **Explanation:** each question under "Questions to revise" now shows its Explanation (typeset maths included) when one is saved for the question. Run the updated `V18_OMR_REPORT_GROUPS.sql` (re-run it if you already ran V18) so students see it too.
* **Maths in "Questions to revise":** fractions, powers, units etc. are now typeset as proper maths. (The previous report had a mistake in the maths-library setting, so formulas were printed as raw `\( … \)` text.) The Print button stays disabled ("Preparing maths…") until typesetting is done; if the maths library cannot be loaded (no internet) the formulas are shown as readable plain text instead of raw code.
* **Run `V18_OMR_REPORT_GROUPS.sql`** once (after V17) so students' downloads also know the subject and lesson names. Without it student reports still work and group by part/topic.
* Upload: `omr-engine.js`, `custom-omr.js`, `student-omr.js`, `main.html`, `teacher-app.js`.
* **Watermark:** every page of the result report carries a light diagonal stamp "SWARUP SIR'S / KNOWLEDGE HUB / Ph: 98643-90279" (double border), also when printed or saved as PDF.
