# V15 – Custom Adaptive Assignment (teacher-controlled)

Works for **JNVST** and **School Course**. No database migration needed — it uses the
same tables and the same student view as the existing automatic adaptive assignments.

## Install
Upload these website files (replace the old ones):
* `custom-adaptive.js`  (new)
* `teacher-app.js`      (two new buttons)
* `main.html`           (loads the new file)

## Where
* **JNVST:** Teacher dashboard → **🎯 Custom Adaptive Assignment**
* **School:** School Course → Manage Assignments → **🎯 Custom Adaptive Assignment**

## How it works
1. **Choose students** – list with answers recorded, accuracy and *active mistakes*.
   Filter by class/group, search, or show only "with mistakes / below 60% / no attempts".
   Tick one student, several, or use *Select shown* for a whole group.
2. **Profile** – click *Profile* for a student: accuracy, weakest chapters/parts (weakest first),
   most frequently wrong questions (Active / Fixed). *Focus on this* adds that area to the focus list.
3. **Settings** – title, subject, medium/part/language, questions per student (1–100),
   **From mistakes %** (0–100, you decide), optional **Focus areas**.
   Two switches (on by default): avoid new questions already given to that student; use a fresh
   *variation* instead of repeating the exact mistaken question.
4. **Generate personal sets** – every student gets their own set. Each row says why it was chosen
   (Mistake / Variation of mistake / New / Seen before). **✕ remove, ⇄ swap, ＋ add** before assigning.
5. **Assign** – one assignment per student. Assigned students are unticked so you can continue.

## Rules
* Active mistake – JNVST: wrong at least once and fewer than 2 correct in a row (OMR included).
  School: wrong at least once and the last answer was not correct.
* Mistakes are used worst-first (most wrong, then most recent). If a student has fewer mistakes than
  the % you asked for, the rest are new questions.
* Passage-based JNVST questions are not used (a passage and its 5 questions must stay together).
* School uses MCQ questions of the chosen subject (and medium) from the School Question Bank.

## Maths
Questions written in LaTeX (`$\frac{2}{3}$`, `\(x^2\)`, ...) are shown as proper maths in the profile and the preview,
the same way as elsewhere in the app. Text containing maths is shown in full (never cut short).

## Image questions
* The profile/preview now show the **image, the question text and the options** (correct option marked ✓).
  When the options are only inside the picture, the preview says so.
* **Fix – School adaptive sets lost their options:** a School question with an image was saved with
  placeholder options ("Option A–D") instead of its real option texts. `teacher-app.js` now keeps the real
  options (this also fixes the existing automatic School adaptive assignment).
* **Student screen:** a question that has an image now also shows its real text (the "[IMAGE QUESTION]"
  placeholder is never shown). `main.html` – quiz and answer-review screens.
* JNVST sets keep real text/options too when the bank has them; image-only questions are unchanged.
* Assignments created *before* this update keep their saved options. Delete and re-create them, or tell me
  and I can add a one-click repair.

## Clean dashboards (personalised assignments grouped as batches)
One custom assignment for 30 students is now **one batch**, not 30 cards / 30 result blocks.
* **JNVST dashboard → Assignments card** has two tabs:
  * **📝 Standard** – latest 10, **Show more**, search by title (your group filters still work).
  * **🎯 Personalised** – one compact card per batch: title, date, group, `N students`, `18/24 submitted · avg 71%`.
    **👥 Students** opens the student table (status, score, View / Edit / Result / Delete per student);
    **📊 Results** jumps to the Results page for that batch; **Delete batch** removes the whole batch.
  * The **Assignments** number at the top counts a batch as one.
* **Assignment Results page** – a batch is **one collapsed block** ("🎯 title · Personalised · N students")
  instead of N blocks; the *Assignment* filter and the Excel export treat a batch as one entry.
* Older automatic adaptive assignments (JNVST/School) are grouped the same way.
* Student screens are unchanged. School "Manage Assignments" list is not changed yet.

## Tested
12 logic tests + a full simulated-browser run (JNVST and School: list, filters, profile, generate,
remove/swap/add, assign, rows written correctly, guards). **Not tested on your live Supabase** —
first assign one small set to one student and open it as that student.
