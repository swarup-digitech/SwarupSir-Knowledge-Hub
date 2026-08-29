# Swarup Sir's Knowledge Hub — Step-by-Step

## 1. Supabase Edge Function

Open Supabase project **SwarupSir** → **Edge Functions**.

Open the existing function **create-students** → **Code**.

Replace its `index.ts` with:
`edge-function/index.ts`

Click **Deploy**.

Keep the function name exactly:
`create-students`

Do NOT put a service-role/secret key into `index.html`.

## 2. SQL policy

Supabase → SQL Editor → New query.

Paste the contents of:
`supabase_teacher_student_policy.sql`

Click Run.

Expected:
`Success. No rows returned`

If the policy already exists, do not create a duplicate.

## 3. Test the local app

Open `index.html` in a browser.

Login using your existing teacher account.

The Teacher Dashboard should show:
- + New Class
- + Add Student
- ↑ Bulk Students (Excel)
- + New Video Assignment
- ↑ Import MCQs (PDF + Excel)

## 4. Bulk students

Make sure your class **Navodaya** exists.

Click:
**Bulk Students (Excel)**

Upload:
`demo_students.xlsx`

Required columns:
- Student Name
- Email
- Password
- Class

Review the preview and click:
**Create All Students**

The Edge Function creates the Auth account, profile, and class membership.

## 5. Bulk MCQs

Click:
**Import MCQs (PDF + Excel)**

Upload:
`demo_mcq_questions.pdf`

Then upload:
`demo_answer_key.xlsx`

PDF format:
- One question per page
- Question text
- A. option
- B. option
- C. option
- D. option

Answer-key Excel:
- Question No
- Correct Option

Click **Preview / Continue** and check the imported questions.

Then enter:
- Class
- Assignment title
- Subject
- YouTube video URL

Create the assignment.

## 6. Test student

Log in with a test student.

Student:
1. Opens the assignment
2. Watches the video
3. Clicks Video watched
4. Answers MCQs
5. Submits
6. Gets the score

Teacher:
1. Opens the assignment
2. Clicks Results
3. Sees the student's score

## 7. Cloudflare Pages

When testing is complete, publish `index.html` using Cloudflare Pages.

This is a static app:
- Framework preset: None
- Build command: empty
- Build output directory: `/`

The app uses Supabase for Auth and database.

## Security

The browser uses only the Supabase publishable key.

Never expose the Supabase service-role/secret key in browser code.
The Edge Function uses the privileged server-side key.
