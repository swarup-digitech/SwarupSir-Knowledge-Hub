# V13 – Security, server-side marking and code clean-up

Student passwords are **unchanged** (still stored and shown as before, as requested).

## Install – do these in this order
1. **Supabase → SQL Editor:** run `V13_SECURE_SCORING_MIGRATION.sql` once. It is safe to re-run and changes no existing data.
2. **Edge Function `create-students`:** replace its code with this `index.ts` and deploy.
   The uploaded live code was identical to the old `index.ts`, so nothing you have is lost.
3. **Website:** upload these files to the site root (same place as `main.html`):
   `main.html`, `teacher-app.js` (new), `common-ui.js` (new), `teacher-dashboard.html`, `student-sw.js`, `student-app.webmanifest`, `manifest.webmanifest`.
4. **Supabase → Authentication → Sign In / Providers:** make sure **"Allow new users to sign up" is OFF**. All accounts are created by teachers through the Edge Function.
5. Test once with a test student: an assignment, a mock test and the result page (see *Testing* below).

> Do step 1 **before** step 3. The new `main.html` calls the new database functions; the old `main.html` will stop scoring once step 1 is done, so do steps 1 and 3 close together (ideally when no test is running).

## 1. Answer keys are hidden and marks are calculated by the database
| Before | Now |
|---|---|
| Student's browser downloaded `correct_option` (and explanation/solutions) for every question. | Questions come from `student_assignment_questions` / `student_mock_start`, which remove the answer key, explanation and solutions. |
| Score calculated in the browser and saved by the student – could be changed. | `student_submit_assignment` / `student_mock_submit` mark the answers in the database. Students cannot insert/update attempts, answers or scores. |
| Mock-test timer (`end_at`) set and changeable by the student. | `student_mock_start` sets the deadline on the server. Answers are refused after deadline + 2 minutes. The on-screen timer is corrected to server time. |
| Answer key visible to students before results were released. | `student_mock_result_questions` gives the key only after the teacher approves results. Assignment review (`student_attempt_review_questions`) works only after submission – same as before. |

Option shuffling still works: the page remembers which original option (A–D) each shuffled option is, and sends the original letter.

## 2. Database hardening (all in the V13 SQL)
* Old mock-test policies from `mock_question_bank_migration.sql` are removed. They caused the *"infinite recursion detected in policy"* error and had a bug (`s.mock_test_id = mock_test_id` compared the column with itself) that let a student read the questions of **every** mock test.
* A student cannot change their own `profiles.role` (for example to `teacher`), cannot create classes and cannot change class memberships.
* `attempts_duplicate_cleanup_backup` and `answers_duplicate_cleanup_backup` are locked (they were readable by any logged-in user).
* New table `edge_login_attempts` (service role only) for the login limit.
* Existing policies are **not** dropped (except the broken mock-test ones). V13 adds *restrictive* policies on top, which only affect accounts whose role is `student`. Teachers work exactly as before.

## 3. Edge Function (`index.ts`)
* **Login limit.** After 8 wrong passwords for one Roll No (or 60 from one network) within 15 minutes, login is paused for that Roll No. The limit per network is generous because a whole school can share one internet connection.
* **No Roll No guessing.** An unknown Roll No and a wrong password now give the same message.
* **Students can't pass as teachers.** A student account can never pass the "owns a class" teacher check.
* **Unknown actions are refused.** An unknown `action` now returns an error. Before, it silently ran "create students".
* **Bulk fee import checks more.** It now checks the date (it must be a real calendar date), uses the reference number in the duplicate check like single payments do, and is limited to 2000 rows per import.
* **Server errors stay private.** Unexpected internal errors are logged and no longer shown to users.
* **Pinned library.** The Supabase library version is pinned (`@2.117.2`).

### ⚠ Found during the work – features that don't work today
Your pages call 8 actions that the live `create-students` function does not have:
`deleteStudent`, `setStudentName`, `setStudentClass`, `setStudentSchoolGroup` (teacher pages) and
`uploadStudentPhoto`, `removeStudentPhoto`, `updateStudentProfile`, `changeStudentPassword` (student profile page).

* **Before:** the teacher actions fell into "create students". They returned *success* but changed nothing. The student actions failed with "Only teachers can use this function".
* **Now:** they show a clear *"Unknown action"* message.

These actions were not added because their behaviour (photo storage bucket, profile fields, password rules) needs your decision.

## 4. Front-end
* **Students download about 75% less code.** `main.html` is now ~190 KB, down from 807 KB. The ~610 KB of teacher-only code moved to `teacher-app.js`, which loads automatically after a **teacher** logs in. URLs and links are unchanged.
* **Duplicate code removed.** Removed 18 older function versions that were replaced later in the file and never ran, including the second `jnvstGetCell`. Overrides that deliberately wrap an earlier version (for example `jnvstQbEdit`) are kept.
* **Messages instead of pop-ups.** All 525 `alert()` pop-ups are now non-blocking messages (`common-ui.js` → `notify()`), coloured green, red or blue with a close button. `confirm()` questions are unchanged.
* **Pinned libraries.** Versions are pinned: supabase-js 2.117.2, MathLive 0.110.0, MathJax 3.2.2. SheetJS moved from 0.18.5 to **0.20.3**, which fixes two known security issues; it is now served from SheetJS's own CDN (`cdn.sheetjs.com`).
* **Bug fixes found along the way:**
  * The countdown for *MOCK-type assignments* never started, so time never ran out. It now counts down and auto-submits.
  * The "View Result & Answers" button after a ≥80% submission threw an error. It now opens the result.

## 5. Service worker / PWA
* **Install no longer fails on a missing file.** A missing pre-cache file no longer breaks installation; files are cached one by one.
* **Only website files are cached.** Supabase and CDN responses, which contain student data, are not stored on the device.
* **Manifest icons fixed.** Icons now point to the real `skh-icon-*.png` files; `manifest.webmanifest` pointed to files that don't exist.

## 6. Housekeeping
* **Numbered migrations.** All 56 old SQL files moved to `supabase/migrations/`, numbered in a tested working order, with V13 last.
  * Three files that failed when run twice were fixed (`supabase_teacher_student_policy`, `mock_test`, `mock_test_migration`).
  * See `supabase/README.md`.
* **Change notes moved.** Old change notes moved to `docs/`.
* **Unused folder removed.** `_archive_unused/` was removed; it is still in git history.
* **Git repository.** The project is now a git repository (`.git` included); the history starts with V12 exactly as received.

## Testing done
* **Database.** All 58 migrations run in order on PostgreSQL 16 (with Supabase's `auth`/`storage` set up locally), twice, with no errors. 25 checks of the V13 rules passed, covering:
  * students can't read keys or write scores
  * correct marking
  * double submission refused
  * deadline enforced
  * result shown only after release
  * role change blocked
  * backup tables locked
  * teachers unaffected
* **Edge function.** Login, the login limit, an unknown Roll No, a student posing as teacher, and an unknown action were all tested with a mock database.
* **Browser (headless Chromium).**
  * Student assignment with shuffled options sends the original letters.
  * Mock test start → answer → submit works.
  * Students never load `teacher-app.js`.
  * The teacher dashboard loads `teacher-app.js`.
  * 112 teacher buttons gave **identical results in V12 and V13**.
  * The School Teacher Dashboard loads with no errors.
* **Not tested:** the real Supabase project and a real phone. Please run the test in *Install → step 5* before a class uses it.
