# School Student Bulk Import Fix

## What was fixed

The School Course Excel importer already made Email optional, but the `create-students` backend still rejected rows when Email was blank. The backend has now been aligned with the School Course UI.

### New behaviour
- Required fields: **Name, Roll No, Class, Password**.
- Email is optional for student creation.
- When Email is blank, the backend creates a private internal Auth email identifier automatically. Students continue to log in only with **Roll No + Password**.
- The student's `profiles.course` is now set from the selected class.
- For School Course students, `school_group_id` is saved when a valid subdivision is selected.
- A supplied subdivision is checked against both the selected class and the logged-in teacher.
- The backend verifies that the requested course matches the selected class.
- Existing explicit email addresses are still supported.

## Deployment

Deploy the updated Edge Function:

```bash
supabase functions deploy create-students
```

Then refresh the School Teacher Dashboard and retry the Excel import.

No new SQL migration is required for this fix if `school_assessment_course_migration.sql` has already been applied, because the existing `profiles.course` and `profiles.school_group_id` columns are used.
