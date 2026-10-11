# Fix: "Name, roll no, email, password and class are required"

Students log in with **Roll No + Password only**. The email is an internal
Supabase Auth identifier, generated automatically, e.g.
`student_1010_0ba15daa@knowledgehub.local`. Passwords are still saved in plain
text in `student_credentials.password_plaintext` so teachers can view them.

Changed file: `index.ts` (Edge Function `create-students`) - nothing else.
- Email is no longer required; auto-generated when missing.
- New students get `profiles.course` from their class (JNVST sub-groups inherit
  the main group's course). Without it, student login rejects the account.
- `school_group_id` is saved for School students.

## Deploy (the fix is in the Edge Function, not the website)
Supabase Dashboard > Edge Functions > create-students > paste index.ts > Deploy
(or `supabase functions deploy create-students`).
