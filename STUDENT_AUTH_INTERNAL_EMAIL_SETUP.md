# Student Authentication — Internal Email Architecture

This project uses **Roll No. + Password** for students in both JNVST and School Course.

Supabase Auth still requires an internal email identity. Therefore the Edge Function
creates an address such as:

`student_1010_0ba15daa@knowledgehub.local`

This is an internal technical identity only. Students do **not** enter, see, or use it.

## Deployment

1. Run `RESTORE_INTERNAL_STUDENT_AUTH.sql` in Supabase SQL Editor.
2. Deploy `supabase/functions/create-students/index.ts`.
3. Do NOT run `STUDENT_AUTH_NO_EMAIL_MIGRATION.sql` after this change; that migration
   removes the `student_credentials.email` column and is obsolete for this architecture.
4. Test one new JNVST student and one new School student.

## Login

Students continue to enter:

- Roll No.
- Password

The Edge Function finds the student's internal Auth email and signs in to Supabase
Auth internally.

## Course separation

The Edge Function validates the teacher-owned class and stores the student's course
from the class (`SCHOOL`, `JNVST-6`, or `JNVST-9`).

The internal email is never returned by the student-facing login response or student
account listing.
