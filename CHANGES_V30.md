# V30: Assignment start time, end time, extension and Publish Results

## Creating an assignment
Every create screen (Create Assignment, Import, Adaptive, 🎯 Custom Adaptive) has a **📅 Schedule** box:
**Start date & time** (filled with "now") and **End date & time** (required; quick buttons +1 hour / +1 day / +3 days / +1 week).
You can create assignments in advance: students see them as **🕒 Opens …** with a locked button until the start time.

## Students
* **Before the start:** "Opens 05 Nov, 10:00 AM", button locked. The database also refuses it.
* **While open:** "⏳ Ends …". During the test, a countdown bar shows the time left (red in the last 5 minutes).
  **At the end time, the answers are submitted automatically.** Submissions arriving up to 5 minutes late are accepted.
* **After the end:** "⛔ Closed — not submitted". The database refuses opening or submitting.
* **After submitting:** the student sees the **score at once**. The answers, answer key, explanations and
  **📊 Class analysis** appear only after you publish. The class analysis shows their rank, their score, the class
  average, the highest and lowest scores, how many submitted, and how many scored 80% or more.
* Scheduled assignments allow **one attempt**. The automatic "below 80% → deleted and redo after 3 hours" rule does
  **not** apply to them, so your published results are complete. Old assignments without a schedule work exactly as before.

## Teacher / Admin — on every assignment card (also personalised batches)
* Status: 🕒 Opens … / 🟢 Open until … / ⛔ Closed …, and 🔒 Results not published / 📢 Results published.
* **📢 Publish Results** (asks for confirmation; warns if the end time has not passed yet) / **🙈 Hide Results**.
  For a personalised batch, this applies to every student's assignment.
* **📅 Schedule / Extend** opens a window:
  1. **Start and end for everyone:** change them, or +1 hour / +1 day / +1 week. A closed assignment opens again
     until the new end time.
  2. **Extend for some students only:** a list of students with Submitted / Not submitted.
     Use **Tick not submitted** → choose the new end time → **⏩ Extend ticked students**, or **Remove their extension**.
     Students see "extended for you".
  3. **Results:** publish or hide.
* An old assignment without a schedule shows **📅 Set schedule**.
* A teacher can schedule, extend and publish their own assignments; the Admin can extend any assignment.

## Install (in this order)
1. Supabase → SQL Editor: run **`V30_ASSIGNMENT_SCHEDULE.sql`** once (select all → Run). The last line shows
   `V30 assignment schedule installed | 3`. It is safe to run again.
2. Upload **`assignment-schedule.js`** (new) and **`main.html`** (now loads `assignment-schedule.js?v=1`).
   Keep `jnvst-qb-excel.js` and `teacher-app.js` from V29 (included again).
3. Press Ctrl+Shift+R.

If the SQL has not been run yet, the 📅 box shows a red note and assignments are created without a schedule.
Nothing breaks.

## Tested
* **PostgreSQL 16 (database functions):** refused before the start and after the end, with the times shown in India
  time. A per-student extension opens it for that student only. Another teacher cannot extend someone else's
  assignment. Before publishing there is no answer key and no analysis; after publishing, both are available.
  Rank, average and the other figures are correct. The 80% reset keeps scheduled results and still works for old
  assignments. An end time before the start time is rejected. The SQL can be run twice.
* **Chromium, teacher screens:** the schedule box blocks a missing or wrong end time. Normal and custom adaptive
  assignments save the times. The card shows the right status. Publish works, also for a whole batch. Extending
  the 2 not-submitted students changes only those 2. +1 day moves the end for everyone. An old assignment can get
  a schedule.
* **Chromium, student screens (real main.html):** "Opens" with a locked button; "Closed"; "extended for you" can be
  started; old assignments are unchanged; the timer auto-submits at the end time; after submitting, the score is
  shown with the answers held back until you publish; after publishing, the answers and class analysis are shown.
  No page errors.

## V30.1 — Class discussion PDF for assignments (same as Custom Test / OMR)
* After **📢 Publish Results** the app asks: *"Create the Class discussion PDF (one question per page) now?"*
  → **OK** opens the usual dialog. You can make it again at any time with the new **📽 Discussion PDF** button
  on every assignment card and personalised batch, also for assignments without a schedule.
* The same pages as the OMR / Custom Test discussion PDF: a wide page per question in big letters, how many chose
  each option, the correct answer ✓, ✗ Wrong / — Skipped / ✓ Correct counts with the students' names (roll no,
  first name, chosen option). Passage pages, optional explanation (Assamese for Assamese questions), writing space,
  and a cover page with a table of all questions.
* The same options: A4 landscape or 16:9; only questions someone got wrong/skipped, or all; paper order or most
  mistakes first; and which students to include. Only students who submitted are listed; for each student, their
  latest submission is used.
* **Personalised batch (🎯 Custom Adaptive):** every student has a different paper. The same question-bank question
  is shown on ONE page ("In 5 student papers"), with each student's own question number, exactly like Custom Test.
* Changed files: `omr-discussion.js` (v=7), `assignment-schedule.js` (v=2), `main.html`. No SQL.
* Tested in Chromium: publish → dialog → PDF; the student list (non-submitters left out); a wrong answer, a skip and
  correct answers on the right pages; an older attempt is ignored; the explanation is shown; in a batch, the shared
  question appears on one page for 2 papers.
