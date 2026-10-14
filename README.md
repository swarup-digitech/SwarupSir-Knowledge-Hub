# Swarup Sir's Knowledge Hub

Student and teacher portal for the JNVST and School courses, built on Supabase.

| File | What it is |
|---|---|
| `main.html` | Login, student app (assignments, mock tests, results, profile) and the shell of the JNVST teacher app |
| `teacher-app.js` | JNVST teacher tools – loaded by `main.html` only after a teacher logs in |
| `teacher-dashboard.html` | School Course teacher dashboard |
| `common-ui.js` | Shared helpers (toast messages `notify()`) |
| `student-sw.js`, `student-app.webmanifest`, `manifest.webmanifest`, `skh-icon*.png` | Installable student app (PWA) |
| `custom-adaptive.js` | V15 Custom Adaptive Assignment (teacher-controlled personal sets) |
| `custom-adaptive-paper.js` | V16 Custom Adaptive Question Paper (one personal JNVST paper per student) |
| `index.ts` | Supabase Edge Function `create-students` (student accounts, login by Roll No, fees) |
| `V13_SECURE_SCORING_MIGRATION.sql` | Database change for V13 (security, server-side marking) |
| `V14_OMR_MISTAKES_MIGRATION.sql` | Database change for V14 (OMR import, mistake streaks) |
| `V16_ADAPTIVE_PAPER_OMR.sql` | Database change for V16 (OMR import finds each student's personal paper) |
| `omr-engine.js` | V17 OMR sheet layout, sheet reader, result report layout |
| `custom-omr.js` | V17 teacher screens: print sheets, scan, review, import, reports |
| `student-omr.js` | V17 student list and PDF download of scanned OMR results |
| `V17_STUDENT_OMR_REPORTS.sql` | Database change for V17 (student result functions) |
| `V18_OMR_REPORT_GROUPS.sql` | Database change for V18 (student report knows subject / lesson names) |
| `V19_COMMON_QUESTIONS.sql` | Database change for V19 (adds the Common label column to the question bank) |
| `V20_ASSAMESE_EXPLANATIONS.sql` | Database change for V20 (Assamese explanations, automatic translation queue, report update) |
| `assamese-explanations.js` | V20 Question Bank add-on: automatic Assamese translation of explanations, status, filter |
| `omr-discussion.js` | V21 Class discussion PDF after an OMR import (one question per wide page, who was wrong/skipped) |
| `V22_SPEED_INDEXES.sql` | Database change for V22 (indexes for faster teacher screens; no data changes) |
| `supabase/functions/translate-explanations/index.ts` | V20 Edge Function that translates explanations into Assamese (Claude API) |
| `supabase/migrations/` | All database changes in order – see `supabase/README.md` |
| `*_Template.xlsx` | Bulk-upload templates for teachers |
| `docs/` | Notes from earlier versions |

Not in this package (they live only on the website): `index.html`, `student-login.html`,
`teacher-login.html`, `school-login.html`, `school-dashboard.html`,
`student-course-selection.html`, and the `get-omr-result` Edge Function.
Add them here so the whole site is versioned together.

See the `CHANGES_V*.md` files for what changed in each version and how to install it. The latest is `CHANGES_V22.md` (faster Teacher Admin Panel).
