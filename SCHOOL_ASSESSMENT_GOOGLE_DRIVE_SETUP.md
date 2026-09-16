# School Assessment Google Drive Setup

The GitHub package now contains:

- `supabase/functions/upload-school-answer/index.ts`
- `google-apps-script/Code.gs`
- `school_assessment_course_migration.sql`

## 1. Supabase
Run `school_assessment_course_migration.sql` in the Supabase SQL Editor.

## 2. Google Drive
Create a parent folder such as `School Answers`.
Open Google Apps Script and paste `google-apps-script/Code.gs`.

In Apps Script → Project Settings → Script Properties, create:

`SCHOOL_ANSWER_DRIVE_FOLDER_ID = <parent folder id>`

Deploy as a Web app:
- Execute as: Me
- Who has access: Anyone

Copy the Web App URL.

## 3. Edge Function secret
Deploy `supabase/functions/upload-school-answer/index.ts` and set:

`GOOGLE_APPS_SCRIPT_URL = <Apps Script Web App URL>`

The student page sends the file to this Edge Function. The Edge Function verifies the logged-in School student and assessment/class before sending the file to Google Drive.

## 4. Review lock
A current submission with `status='reviewed'` cannot receive another upload. The Edge Function rejects the upload even if a student tries to bypass the browser UI.

Teacher re-assignment should set the current submission(s) to `is_current=false`; then the student receives a new submission number and can upload again.
