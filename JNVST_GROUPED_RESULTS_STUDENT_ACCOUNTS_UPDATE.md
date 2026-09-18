# JNVST Teacher Dashboard — Grouped Results & Student Accounts

Implemented in this package:

## Assignment Results
- Results are displayed hierarchically as **Main Group → Sub-group → Assignment → Students**.
- Existing filters remain available: Main Group, Sub-group, Assignment, Class, Student, Status, Minimum Score %, Maximum Score %, and Sort.
- Each assignment expands to show the student-wise result table.
- The existing filtered/all Excel downloads remain available.

## Student Accounts
- Accounts are displayed as **Main Group → Sub-group → Students**.
- Roll No remains fixed.
- Teachers can change a student's password.
- Teachers can move a student to another sub-group under the **same main group**.
- The move is confirmed and is performed through the teacher-only Edge Function.

## Back navigation
- Home/dashboard pages no longer display a Back button.
- Other pages use a safe Back action: it returns to the previous same-origin page when appropriate; otherwise it returns to the correct portal home.

## Deployment
Redeploy the updated `supabase/functions/create-students/index.ts` Edge Function. The matching `create-students.ts` source is also updated.

No new database migration is required beyond the existing JNVST group/subject migration that adds `jnvst_group_type` and `jnvst_parent_id`.
