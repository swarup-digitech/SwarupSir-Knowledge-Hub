# MOCK TEST Feature

This build includes MOCK TEST as a separate feature from normal Assignments.

## Included
- Teacher: Mock Test Management
- MAT, EVS, Arithmetic and Language question banks
- PDF + Answer Key upload for MAT/Arithmetic
- Excel upload for EVS/Language
- Question-bank management
- Generate fixed 80-question Mock Test
- 100 marks, 2 hours, 1.25 marks/question
- Assign to multiple classes / selected students
- Student Mock Tests dashboard
- Resume saved attempt
- Server deadline timer
- Auto-submit when time ends
- Section-wise result
- Teacher Mock Test Results

## Supabase setup
Run `SQL/mock_question_bank_migration.sql` in Supabase SQL Editor before using Mock Test.
`SQL/mock_test_migration.sql` is included as the earlier/compatibility migration; do not blindly run duplicate table definitions if the newer migration has already been applied.
