# Question Bank → Assignment / Student Mistake Bank Fix — Version 32

This version is based on the uploaded Version 31 project.

## Verified
- New JNVST Assignment in `main.html` contains **Select From Question Bank**.
- New JNVST Assignment contains **Select Student Mistakes**.
- Selected Question Bank questions are saved as assignment snapshots with `source_mock_question_id`.
- Student mistake tracking uses `student_question_performance` and `record_student_question_results()`.
- Supabase migrations required:
  1. `ASSIGNMENT_MOCK_QUESTION_BANK_MIGRATION.sql`
  2. `STUDENT_MISTAKE_BANK_MIGRATION.sql`
- JavaScript syntax checked with Node.js.
- Service-worker cache version bumped from v7 to v8 so deployed browsers refresh the updated shell.

## Important
The uploaded project already contained the Question Bank buttons. If the live browser still shows only Upload PDF/Excel and Add MCQ manually, the live site is serving an older `main.html` (or an old deployment). Deploy this Version 32 project and hard-refresh the browser. If a service worker is installed, unregister/clear the old site data once if necessary.
