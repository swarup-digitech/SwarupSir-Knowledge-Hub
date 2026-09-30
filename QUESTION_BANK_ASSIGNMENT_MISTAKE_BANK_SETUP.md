# Assignment Question Bank + Student Mistake Bank Fix

This version explicitly exposes the Question Bank and Student Mistakes choices on New Assignment.

## Required Supabase setup

Run these once, in order:
1. `ASSIGNMENT_MOCK_QUESTION_BANK_MIGRATION.sql`
2. `STUDENT_MISTAKE_BANK_MIGRATION.sql`

Then deploy the updated `main.html`.

## New Assignment
The Questions section now visibly contains:
- Select From Question Bank
- Select Student Mistakes
- Upload Question File
- Add MCQ manually

Question Bank requires an assignment Subject to be selected first.

## Tracking
Questions selected from the Mock Test Question Bank are stored in assignments as snapshots with `source_mock_question_id`. Student submissions call `record_student_question_results()` so wrong/correct history can be used in future assignments.
