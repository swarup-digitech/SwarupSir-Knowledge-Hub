# V23: Custom Test — your questions, a variation for every student, personal OMR

You choose the questions. Every selected student gets a personal paper:

* a chosen question **with a Variation Group** → each student gets one question of that group (a *variation*),
* a chosen question **without a Variation Group** → the same question is in every paper,
* the **question order is different** for every student.

The papers are printed with each student's name and roll no., each student gets their own OMR sheet, and the
imported OMR results go into the **Mistake Bank** exactly like Custom Adaptive Papers.

New file: `custom-test.js`. Changed files: `main.html` (loads the new file, version numbers), `teacher-app.js`
(📝 Custom Test button; Generated History reads the paper kind), `custom-omr.js` (Custom Test / Adaptive label), README.
No SQL to run (needs V16, which you already have). Upload the files and press Ctrl+Shift+R.

## Where to find it
Question Paper Generator → **📝 Custom Test** (next to 🎯 Custom Adaptive Papers).

## How to use
1. **Test** – title, subject (Arithmetic / MAT / EVS / Language), language, options:
   * give each student a **variation** (on by default)
   * the chosen question may also be one of the variations (on)
   * prefer variations the student has **not attempted** and was **not given** in an earlier personal paper (on)
   * **different question order** for every student (on). Passage questions stay 1–5 inside their passage;
     EVS MCQs stay before the passages; MAT questions stay inside their part.
2. **Choose questions** – search, filter by lesson/topic, "only questions with variations", "only chosen".
   Each question shows its group and how many variations it has, or *"No group — same question for every student"*.
   Only **one question per Variation Group** can be ticked (the others of that group are greyed out), because
   every student already gets a variation of it. EVS and Language passages are chosen as whole passages.
3. **Choose students** – class filter, search, select shown.
4. **⚙ Generate personal papers**
   * *How the variations are spread* shows how many students got each variation.
   * Variations are shared out evenly, and students next to each other in roll order get different variations.
   * Open a student to check the paper; **⇄ Other variation** gives that student the next variation.
   * Tags: *Variation*, *Your question*, *Same for all*.
5. **🖨️ Save to history & print** – runs the normal Paper Quality Control for every paper, saves the batch to
   Generated History, and prints all papers with names and roll numbers (answer key after each paper if chosen).
   **📊 Answer key Excel** gives one column per student.
6. **🧾 Print OMR sheets, scan & import results** (button after saving, or *Personal OMR Sheets*): print each
   student's own OMR sheet, scan the filled sheets, import. Every student is matched to their own paper by roll no.;
   every wrong or blank answer goes into the Mistake Bank on the exact question that student had, so Custom
   Adaptive Papers and Assignments use it next time. Result reports and the Class discussion PDF work as before.
   *Import OMR Results* with the paper's serial works too.

## Tested
* 23 unit checks: variations spread evenly (30 students over 8 variations: 3–4 each), neighbours differ,
  unattempted / not-yet-given variations first, no repeated question or group in a paper, questions without a
  group in every paper, different order per student, MAT parts, EVS passages (similar passages alternate,
  MCQs before passages, passage questions 1–5), one-per-group rule.
* Browser run with the real `teacher-app.js` and a test bank: choose, refuse a 2nd question of a group,
  generate 8 papers, ⇄ Other variation, Quality Control, save, print window (names on every paper), open the
  batch in Personal OMR Sheets; EVS test with passages. No page errors.
* The real OMR import function in PostgreSQL 16 (mistake bank + history + V14 + V14 fix + V16 files):
  3 students, each matched to their own paper, mistakes recorded on each student's own variation,
  a second import of the same student refused.
**Not tested on your live Supabase project.**

## V23.1 — Lesson filter includes sub-lessons
In *2. Choose questions* the **Lesson** list is now a tree with the number of questions, e.g.
`2.0 Four fundamental operations (15)`, `— 2.1 … (6)`. Choosing a lesson shows the questions of that lesson
**and all its sub-lessons** (2.0 shows 2.0, 2.1, 2.2, 2.2.1 …); choosing 2.2 shows only 2.2 and its own sub-lessons.
It follows the lesson tree of *Manage Groups & Subjects*; a question that is not linked to a lesson record is
placed by its lesson code (2.1 belongs to 2.0; 2.10 is not under 2.1). Changed files: `custom-test.js`, `main.html`.

## V23.2 — Chapters with sub-chapters in all paper tools
* **Question Paper Generator (Arithmetic → Chapters / Sub-chapters):** a ticked chapter already included its
  sub-chapters through the lesson tree. Now it also includes sub-chapters that have no parent link, and questions
  that carry only a lesson code (for example from an older bulk upload): 2.0 takes 2.1, 2.2 …, but 2.1 never takes 2.10.
  Every chapter shows its number of questions; a chapter without sub-chapters is shown as a chapter, not a sub-chapter.
* **Custom Adaptive Papers:** new folding box **Chapters / sub-chapters** under the paper structure. Tick one or more
  chapters to build the papers only from them (mistakes included); a chapter includes all its sub-chapters.
  *Available in your bank* then counts only those chapters. Changing the subject clears the ticks.
  A passage counts when one of its questions is in a ticked chapter.
* **Custom Test:** the same chapter matching; the list only shows chapters of the chosen subject (Arithmetic 2.0 and
  EVS 2.0 are no longer mixed).
Changed files: `teacher-app.js`, `custom-adaptive-paper.js`, `custom-test.js`, `main.html`.
Tested: 10 chapter-matching checks; browser run with the real `teacher-app.js` (generator: 1.0 → 21, 3.0 → 21 with an
unlinked 3.1, 5.2 → 11, 1.0 + 5.0 → 39 questions; adaptive: chapters 1.0 + 6.0 → paper only from 1.0–1.3 and 6.0); all earlier checks still pass.

## Not included
* Option order (A–D) is not shuffled — only the question order, so the printed answer key stays simple.
* School Course papers.
