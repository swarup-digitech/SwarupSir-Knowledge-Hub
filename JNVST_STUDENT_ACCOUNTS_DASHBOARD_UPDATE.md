# JNVST Student Accounts Dashboard Update

- Removed student names and login details from the JNVST Teacher Dashboard.
- Removed Add Student and Bulk Students actions from the dashboard.
- All student operations are inside Student Accounts.
- Student Accounts provides search/filter, add student, bulk Excel import, name/roll/password changes, JNVST subgroup changes, and permanent deletion.
- Added prominent warnings and confirmation steps before account changes.
- Password changes warn that the old password stops working immediately.
- Deletion requires two confirmations, including exact student-name confirmation.
- Updated `create-students.ts` so teacher-scoped name editing and deletion work for JNVST students as well as School students.
- No database migration is required. Deploy the updated Edge Function after replacing `create-students.ts`.
