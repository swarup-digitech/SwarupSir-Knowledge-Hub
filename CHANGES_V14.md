# V14 – OMR results in the Mistake Bank + 60% Adaptive JNVST Assignments

V14 is built on V13. If V13 is not installed yet, do the V13 steps first (see `CHANGES_V13.md`).

## Install
1. **Supabase → SQL Editor:** run `V14_OMR_MISTAKES_MIGRATION.sql` once. It is safe to re-run.
2. **Website:** upload `teacher-app.js`. It is the only website file that changed since V13.

## Rules (as you decided)
| Rule | How it works |
|---|---|
| **Unanswered** | Counts as a mistake. A multiple mark such as “A, C” is also a mistake. |
| **Fixed** | Two correct answers **in a row** in an online test, assignment or OMR exam. Any wrong or blank answer resets the count to 0. |
| **60%** | Applied **within each part** (MAT Pattern, MAT Series, …, Arithmetic, EVS MCQ). |
| **Paper link** | The paper is found automatically from Question Paper Generator history. **Exam Set is optional**: each student's set is detected automatically (see below). |

## 1. Import OMR Results
**Mock Test Management → 📥 Import OMR Results → choose the Excel file.**

* **Reads your OMR software's Excel as it is:** Roll No, Name, Exam, Exam Set, and `Q n Options` / `Q n Key` / `Q n Marks`.
* **Paper code (recommended).** The code printed on every question paper, e.g. `QSET-20261009-182557-OZJX-A`, has four parts:
  * `QSET` marks it as a generated paper;
  * `20261009-182557` is the date and time it was generated;
  * `OZJX` is a random code that makes it unique;
  * `-A` is the set.

  All sets of one paper share the same code; only the last letter differs. **Easiest:** write the full code with the set letter (e.g. `QSET-20261009-182557-OZJX-A`) in the **Exam Set** column; the importer takes the paper from the code and the set from the last letter. You can also put the code in the OMR software's **Exam name** or in the Excel **file name**. A full code with the set letter in a student's row also gives that student's set. If the code is not in your history, or the answers don't fit that paper, you are warned and nothing wrong is imported.
* **Finds the paper automatically** when there is no code. It compares the keys on the sheet with every saved paper in **Question Paper Generator** history, picks the best match and shows the match %. You can choose another paper from the list.
* **Shows a check table before anything is saved:**
  * students per set
  * whether the saved paper has that set
  * answer keys matching (e.g. 39/39)
  * bonus questions found
* **Exam Set column is optional.** For each student the importer finds the set by:
  1. the sheet's **Q n Key** columns, which are exact when present; or
  2. the student's **answers** compared with each set's saved key.

  Tested on your file: 36 of 36 students got the right set **with the Exam Set column removed**, and also with both the Exam Set and Key columns removed (answers only).
* **Typos in Exam Set are caught.** A typed Exam Set that disagrees with the keys is corrected and listed for you to see.
* **Unclear students are not imported.** If a set can't be decided, that student is listed and left out until you add their Exam Set.
* **Absent students** (no answers marked) are skipped.
* **Bonus questions** (needs the `Q n Marks` columns; marks given although the answer ≠ key; in your sample, Set C Q21 and Set A Q23) are skipped, so they don't create false mistakes.
* **Two steps, nothing saved before the second:**
  1. **Check Students** reports Roll Nos not found in your classes (e.g. `0000`) and students already imported.
  2. **Import** adds the results.
* **Marked against the saved key.** The database marks each answer against the saved paper's key, not the sheet. A question whose sheet key differs from the saved key is skipped and listed.
* **No double counting.** A student can be imported only once per paper.
* **History.** Every import is kept (`omr_imports`, `omr_responses`) and listed on the same page.

**Checked with your file `Mental_Ability_Test-1_2026-09-29-3.xlsx`:**
* 36 students with answers, 17 absent, 40 questions, Sets A/B/C.
* Bonus questions C-21 and A-23 were detected.
* Correct answers per student match the sheet's own *Correct Answers* column exactly (e.g. Roll 1040: 30 correct, 9 mistakes = 8 incorrect + 1 not attempted).

## 2. Adaptive JNVST Assignment (60% from mistakes)
**New JNVST Assignment → 🎯 Assignment Personalization → Adaptive Assignment.**

1. **Choose students and build the question set as usual,** with *Build Assignment from JNVST Lesson* or *Select From JNVST Mock Test Question Bank*. This set is the blueprint: it decides how many questions each part gets, and (with the lesson builder) the lesson range.
2. **For every student, in every part:**
   * **60% are that student's own active mistakes.** These come from online tests, assignments and imported OMR exams, most-wrong first, then most recent. The share is rounded, and at least one new question is kept when the part has two or more questions (e.g. 4 → 2 + 2, 5 → 3 + 2, 20 → 12 + 8).
   * **The rest are new questions from the same part.** Questions the student has never attempted come first.
   * **Fewer mistakes than 60% means more new questions**, so the size stays the same.
   * **Passage questions** (Language / EVS passage groups) stay as selected, because a passage cannot be split.
3. **Each student gets a personal copy.** On the teacher dashboard it shows a 🎯 tag with the student's name, roll no and number of mistake questions.

**Select Student Mistakes** (the manual picker) now also hides mistakes that are already fixed (two correct in a row).

## Testing done
* **Database:** all 59 migrations run twice on PostgreSQL 16 with no errors.
* **OMR import with your real sheet:**
  * The check step saves nothing.
  * Totals match the sheet.
  * A second import is refused.
  * A student cannot run the import.
* **Mistake rule:** the streak works (wrong → 1 correct still a mistake → 2 correct fixed → wrong again a mistake).
* **Browser, OMR screen:** it reads your Excel, picks the right paper over a decoy (100% vs 30%), and sends the correct data with bonus questions marked.
* **Browser, adaptive assignment:**
  * Correct per-part counts.
  * Fixed mistakes are not used.
  * Passage parts are kept.
  * One personal assignment per student.
* **Regression:** all 113 teacher-page buttons behave exactly as in V13.
* **Not tested:** your live Supabase project. Import one paper, then create one small adaptive assignment for two students and open it as a student.
