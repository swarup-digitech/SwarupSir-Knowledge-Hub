# V16 — Custom Adaptive Question Paper

A personal JNVST question paper for every student, built from that student's own results.
You check every paper, change any question, then print. Same layout as the normal Question Paper Generator.

## Install (3 steps)
1. Upload the new/changed files: `custom-adaptive-paper.js` (new), `teacher-app.js`, `main.html`, `custom-adaptive.js` (unchanged from V15 but required).
2. Supabase → SQL Editor → run **`V16_ADAPTIVE_PAPER_OMR.sql`** once (after the V14 files). Safe to re-run. It only changes the OMR import function so it can find each student's own paper.
3. Reload the page once (the loader now asks for `teacher-app.js?v=20`).

## How to use
Mock Test Management → **🎯 Custom Adaptive Papers**  (also a button inside *Question Paper Generator*).

1. **Paper** – title, subject (MAT / Arithmetic / EVS / Language), language, structure (MAT: questions per part, default 4 each; Arithmetic: count; EVS: sets of 15 MCQ + 1 passage; Language: passages), and **From mistakes %** (default **60**).
2. **Students** – class filter, search, "with mistakes in this paper's questions". Tick one, a few, or all.
3. **Generate** – every student gets a paper. Open a student to check it:
   * each question is tagged *Mistake / Variation of mistake / New / Seen before / Chosen by you*
   * **⇄ Swap** (random alternative), **✎ Choose…** (pick from a searchable list, best choices first), **✕ Remove**, **+ Add question**
   * passages are swapped as a whole (5 questions together)
   * **✓ Mark verified** per student, or *Mark all verified*
4. **🖨️ Save to history & print** – runs the same Paper Quality Control as the normal generator for every paper (a paper with a problem is listed and nothing is printed), saves all papers to *Generated History*, then opens one print window: every page shows the student's **name and roll no.**; an answer key can follow each paper.
   **📊 Answer key Excel** gives one column per student.

## The 60% rule
For every part separately: `round(questions in the part × 60%)` come from the student's **active mistakes** in that part; the rest are new questions.
* Active mistake = wrong at least once and not yet answered correctly twice in a row (online tests, assignments and imported OMR sheets all count).
* Worst mistakes (most wrong answers, then most recent) are taken first.
* If a question has a Variation Group, a never-attempted variation of it is used instead of the exact question (can be switched off).
* Fewer mistakes than the target → the remaining places are new questions. Unseen questions come first. Questions printed in this student's earlier personal papers are avoided (can be switched off).
* Passages (EVS / Language) are chosen as whole units: the passages containing the most mistakes first.
* Only one question per Variation Group in a paper.

## After the exam – OMR import
Import OMR Results works as before. Pick the batch (shown as "N personal papers") – each student's sheet is matched to **their own paper by roll no.**, their mistakes go to the Mistake Bank, and the next adaptive paper/assignment uses them. If a sheet's printed key does not match the student's paper (< 50%) that student is listed and not imported. Students without a paper in the batch are reported.

## Generated History
A batch appears as one entry "Personalised · N students" (the student list opens on click). *All Questions* prints every student's paper; *All Answer Key Excel* has one column per roll no.; *Delete All* removes the batch. The history list no longer loads the full question data of every paper, so it stays fast with many papers.

## Tested
* 27 unit checks (60% per part, worst-first, fixed questions ignored, variations, avoid-repeat, passages, shortages, swap candidates).
* Browser simulation of the screen: MAT and Language flows, edit/verify, Quality-Control block, save failure, printed names, history batch print, avoid-repeat across two generations, OMR matching.
* The real OMR import function in PostgreSQL 16 (V14 + V14-fix + V16 files in order): personal batch matched by student, unknown roll reported, double import blocked, ordinary A/B papers unchanged.
* All V15 tests still pass.
**Not tested on your live Supabase project.**

## Not included (yet)
* School Course papers (their generator is blueprint/marks based and School results come only from online assignments).
* Editing the text of a question inside this screen – use *Manage Question Bank*; the paper takes the edited question next time it is generated.
