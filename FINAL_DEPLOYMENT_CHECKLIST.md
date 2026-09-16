# Final Deployment Checklist

1. Replace the GitHub HTML/PWA files from this package.
2. Deploy `supabase/functions/create-students/index.ts`.
3. Run `school_assessment_course_migration.sql` if the School tables/course columns/RLS do not already exist.
4. Deploy `supabase/functions/upload-school-answer/index.ts`.
5. Configure the `GOOGLE_APPS_SCRIPT_URL` Edge Function environment value.
6. Deploy `google-apps-script/Code.gs` as a Google Apps Script web app and configure `SCHOOL_ANSWER_DRIVE_FOLDER_ID`.
7. Test:
   - Course Selection → School Course → School Login
   - Welcome → Mock Tests → School Assessments → My Assignments
   - Open My Assessments → Open Assessment
   - Camera / multiple images / PDF upload
   - Teacher review
   - Confirm upload controls lock after review
   - Teacher Re-Assign
   - Confirm a new submission can be uploaded
8. Remove any old installed PWA and reinstall on a test phone so the new service worker and icon are refreshed.
