# Swarup Sir's Knowledge Hub

Student and teacher portal for the JNVST and School courses, built on Supabase.

| File | What it is |
|---|---|
| `main.html` | Login, student app (assignments, mock tests, results, profile) and the shell of the JNVST teacher app |
| `teacher-app.js` | JNVST teacher tools – loaded by `main.html` only after a teacher logs in |
| `teacher-dashboard.html` | School Course teacher dashboard |
| `common-ui.js` | Shared helpers (toast messages `notify()`) |
| `student-sw.js`, `student-app.webmanifest`, `manifest.webmanifest`, `skh-icon*.png` | Installable student app (PWA) |
| `index.ts` | Supabase Edge Function `create-students` (student accounts, login by Roll No, fees) |
| `V13_SECURE_SCORING_MIGRATION.sql` | Database change for V13 (security, server-side marking) |
| `V14_OMR_MISTAKES_MIGRATION.sql` | Database change for V14 (OMR import, mistake streaks) |
| `supabase/migrations/` | All database changes in order – see `supabase/README.md` |
| `*_Template.xlsx` | Bulk-upload templates for teachers |
| `docs/` | Notes from earlier versions |

Not in this package (they live only on the website): `index.html`, `student-login.html`,
`teacher-login.html`, `school-login.html`, `school-dashboard.html`,
`student-course-selection.html`, and the `get-omr-result` Edge Function.
Add them here so the whole site is versioned together.

See `CHANGES_V13.md` and `CHANGES_V14.md` for what changed and how to install it.
