Swarup Sir's Knowledge Hub — Complete Updated Package

Includes:
- Student-only login page + PWA/Home Screen support
- Teacher login page
- Latest index.html with:
  * Student/Teacher separated login flow
  * 80% pass threshold and retry below 80%
  * Attempt history and attempt numbering
  * 3-hour assignment time limit support
  * Multi-class / multi-student assignment
  * Teacher Student Accounts: change Roll No, Password and Class Type
- create-students.ts Edge Function with teacher class-type update support
- SQL for multi-attempt retry support
- SQL for profiles.class_type
- SQL for teacher-viewable student credentials
- SKH PWA manifest, service worker and icon

Deployment:
1. Replace the deployed index.html with this package's index.html.
2. Deploy create-students.ts to the existing Supabase Edge Function named create-students.
3. Run multi_attempts_80_percent_retry.sql in Supabase SQL Editor.
4. Run student_class_type.sql in Supabase SQL Editor.
5. Keep student-login.html, teacher-login.html, student-app.webmanifest, student-sw.js and skh-icon.png at the site root.
6. Do not recreate the old unique attempts index from one_submission.sql.

PWA note:
If an older SKH shortcut still shows ERR_FAILED, remove the old shortcut once and install the updated app again after deployment.
