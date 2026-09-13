# GitHub + Cloudflare Pages + Supabase Setup

## 1. GitHub
1. Back up the existing repository first.
2. Upload the CONTENTS of this package into the repository root.
3. Replace the existing `main.html` with this package's `main.html`.
4. Keep the PWA files, login files, images and SQL files.
5. The Supabase Edge Function is now in the correct deployable location:
   `supabase/functions/create-students/index.ts`
6. Commit to the `main` branch.

## 2. Cloudflare Pages
If Pages is connected to this GitHub repository, the new commit should trigger a deployment.
Use no build command for this plain HTML app. The repository root is the published directory.

## 3. Supabase database
DO NOT delete existing tables, students, assignments or results.

For an already-working installation, do not blindly rerun every historical migration. Run only migrations that are missing. In particular, run `SQL/mock_question_bank_migration.sql` if Mock Test question-bank tables do not yet exist.

## 4. Edge Function
From the repository root with Supabase CLI:

```bash
supabase login
supabase link --project-ref jupefjdquakqsizapzbv
supabase functions deploy create-students
```

## 5. Test after deployment
- Teacher login
- Student login
- New Assignment
- Multiple-class assignment
- Student View My Answer → Correct / Wrong tabs
- Mock Test Management
- MAT / EVS / Arithmetic / Language banks
- Generate & Assign Mock Test
- Mock Test Results

If the browser keeps showing an older version, hard-refresh and clear the site's service-worker/cache data.

## Security
Never put a Supabase service-role key in browser code or GitHub. Browser code should use only the publishable/anon key.
