# V36: Generate Mock Test — pick every question, random MAT block order, directions instead of pattern names

**No database change.** Only two files change: `main.html` and `teacher-app.js` (now `?v=50`).

## What changed
1. **Pick the question for every slot (Mock Test Management → Generate Mock Test).**
   The old "Set 1 / Set 2 / Random set" drop-downs are replaced by one row per question slot (MAT 4 per block, EVS 15, Arithmetic 20) and one row per passage (EVS 1, Language 4).
   * **Change** opens a picture/text grid of the whole bank for that part (with search). Picking a question already used in another slot of the same block **swaps** the two.
   * Shortcuts kept: **Fill from set** (per part), **Set 1 for all**, **Random sets**, plus new **🎲 Random** (per part) and **Random questions (mix sets)**.
   * The test cannot be created until every slot is filled and no question is used twice.
2. **MAT blocks in random order, questions shuffled inside each block, one order per booklet series (A–D).**
   * New tick box *Also shuffle the 4 questions inside each block* (on by default).
   * New drop-down *Booklet series*: 4 (A–D, default), 3, 2 or 1. **One test is made per series** (title “Mock Test — Series A” …), each with its **own MAT block order and question order**; no two series share the same block order. Students are spread over the series at random and as equally as possible. The printed booklet shows that series code as its Test Booklet Code. Choose “1 series” to keep a single test for everyone.
   * Results are therefore listed per series test in Mock Test Results.
   * (Original text of this item follows.) Tick box *Random order of the 5 MAT blocks* (on by default). The five blocks of 4 are shuffled when the test is generated; each block stays together. After generating, the message tells the teacher which block went where (teacher only).
3. **Directions instead of pattern names.**
   * Students see `Question 6 of 80 · Mental Ability · Part II` and a **Directions** box. The words Pattern / Series / Mirror etc. are not shown any more.
   * The directions are new texts for the five syllabus types (pattern completion, figure series, geometrical figure completion, mirror & water image, embedded figure). The old texts in `JNVST_PDF_DIRECTIONS` were still the 2021 ten-part wording (odd one out, figure matching, analogy …) and did not match the bank. The question range ("Question Nos. 9 to 12") is filled in from where the block actually sits.
   * Directions are also shown for EVS, EVS passage, Arithmetic and Language.
4. **Printed question paper (Mock Test → question paper PDF).** Blocks are printed in the order of the test, headed **PART I … PART V** with their direction (OMR sentence included). The fixed "Sub-Part A — Questions 1 to 4" headings are gone.

## V36.2 — question paper clean-up
* **“[IMAGE QUESTION]” is no longer printed** under the picture questions in the question-paper PDF, and is no longer shown on the student's online exam screen (the picture is the question).
* **Blank pages removed.** The PDF had an empty page after the MAT pages and after the Arithmetic page. Cause: the empty bottom margin of a section spilled onto a new page, and each section was forced to break after itself. Now every section is sized to whole pages (ignoring that empty margin) and sections are separated with “break before”. The last page (SPACE FOR ROUGH WORK) is kept on purpose; tell me if you want it removed too.
* `teacher-app.js?v=51`.

## Install
| File | What to do |
|---|---|
| `main.html`, `teacher-app.js` | Upload (replace). |

Then Ctrl+Shift+R. Tests created **before** V36 still work: they simply show Part I–V in their old fixed order.

## Tested (headless Chrome, sample bank, fake Supabase)
Slot picker (open, search list, swap, clear), "slots not complete" check, test creation: 80 rows, numbers 1–80, five MAT blocks shuffled and contiguous, rows for EVS/Arithmetic/Language in place; student exam screen shows the right Part number and range for Q1, 6, 10, 14, 18, 22, 37, 41, 71; question paper HTML has PART I–V with the right ranges and no pattern names.
With 4 series: four tests, four different block orders, different question order inside the blocks, students split between them, series code on the title; if a step fails the tests already created are deleted.
**Not tested:** against the real Supabase database, with real MAT picture questions, or the browser print dialog. Please generate one test with your own bank first.

## Notes
* Old tests that were generated with the same fixed order keep `part_code` in the database; it is just not shown to students any more. Result sheets and the teacher results screens are unchanged.
* `student_mock_start` is unchanged; the app now sorts the questions by number after loading them.
