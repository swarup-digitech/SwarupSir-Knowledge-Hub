# V19 — "Common" label for questions frequently asked in exams

**Run first:** `V19_COMMON_QUESTIONS.sql` (Supabase SQL Editor, once). Then upload all changed files and press Ctrl+Shift+R.
Changed files: `teacher-app.js`, `custom-adaptive.js`, `custom-adaptive-paper.js`, `main.html`, the three Excel templates, README.

Applies to the **JNVST / Mock question bank**. School Course is unchanged.

## 1. Marking questions Common
* Edit a question (single or passage block): new **⭐ Common** tick box. Manual "add question" has it too.
* Question Bank → tick questions → **⭐ Mark Selected as Common** / **Remove Common from Selected**.
* **Variation rule:** if any question of a Variation Group is Common, every question of that group is treated as Common
  (shown as "⭐ Common (via group)"). Nothing extra is stored; remove Common from the marked one(s) and the group goes back to normal.

## 2. Question Bank filters
* New **Difficulty Level** filter (Easy / Medium / Hard / Not set) and **Common** filter (All / Common only / Not common).
  They combine with Subject, Medium, Lesson, Variation Group and Search. "Common only" includes the variation-group members.
* New column **Level / Common** with coloured badges.

## 3. Bulk upload – new `Common` column (YES / NO, blank = NO)
JNVST Excel, JNVST MAT PDF-metadata Excel, Mock Excel and Mock MAT PDF-metadata Excel — both the in-app
"Excel Template" downloads and the three static template files. Old files without the column still upload (all NO).
Also fixed: the sample rows of the in-app JNVST template had the answer one column to the right.

## 4. Question Paper Generator
New option **⭐ Common questions → On**. For MAT parts, Arithmetic, EVS (MCQs and passages) and Language passages the
random slots are filled from Common questions first (random among them); if there are not enough, the rest come from the
whole bank. Mandatory questions, topic limits, one-per-variation-group, order, sets etc. work exactly as before.
A passage counts as Common if any of its questions is Common.

## 5. Custom Adaptive Question Paper
New tick box (on by default): the 60 % (adjustable) mistake share is unchanged; the remaining slots are taken from the
Common pool first (fresh, not-printed-before ones first), then from the rest of the bank. Passage subjects choose Common
passages first. The "swap / choose" candidate lists also show Common questions first.
