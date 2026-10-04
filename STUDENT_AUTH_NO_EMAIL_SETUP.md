# Student Authentication — No Email

This version changes student authentication to:

**Roll No + Password** for both **JNVST** and **School Course**.

No student email address is requested, generated, stored, displayed, or used for student authentication.

## 1. Run the SQL migration

Run:

`STUDENT_AUTH_NO_EMAIL_MIGRATION.sql`

This removes `student_credentials.email`.

## 2. Configure the Edge Function secret

The new `create-students` function signs the student session JWT directly.

Add the project's **JWT secret** as the Edge Function secret:

`SUPABASE_JWT_SECRET`

The value must be the same JWT signing secret used by the Supabase project.

Do not put this secret in any HTML, JavaScript, Excel file, or GitHub repository.

## 3. Deploy `create-students`

Deploy:

`supabase/functions/create-students/index.ts`

## 4. Student account creation

Required fields are now only:

- Name
- Roll No.
- Password
- Class/JNVST Group

The Edge Function creates the student profile directly and stores the classroom password in `student_credentials`.

## 5. Student login

Students continue to enter:

- Roll No.
- Password

The frontend does not ask for an email.

## Important

Existing students that were created through the old email-based Supabase Auth system are not automatically converted by this migration. Test with a newly created student first. Existing student migration should be handled separately after confirming the new authentication flow.
