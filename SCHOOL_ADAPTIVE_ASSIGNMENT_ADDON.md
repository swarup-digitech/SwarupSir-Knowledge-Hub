# School Course Adaptive Assignment Add-on

This add-on preserves the existing School Course assignment workflow. Standard assignments continue to use the existing generator unchanged.

## What it adds

- Optional **Adaptive Assignment** mode under School Course → New Assignment.
- Personalized assignment questions per student.
- **Maximum Adaptive / Weakness Questions = 60%** by default and hard-capped in the UI/logic at 60%.
- Previous wrong questions are prioritized.
- When a wrong question has a Variation Group, an unattempted variation is preferred instead of repeating the exact question.
- Previously scheduled question snapshots are avoided when possible.
- Remaining questions are selected from unseen/new questions first, then other usable questions.
- Wrong/correct/attempt counts are tracked for School Question Bank questions.
- Teacher dashboard for topic-level struggle and most frequently wrong questions.
- Adaptive assignment metadata records how many adaptive and normal questions were used.

## Database migration

Run this file once in Supabase SQL Editor:

`SCHOOL_ADAPTIVE_ASSIGNMENT_MIGRATION.sql`

The migration is additive and uses `IF NOT EXISTS` for the new columns/table/indexes. Existing assignment data is not converted to adaptive assignments.

## How to use

1. Open **School Course → New Assignment**.
2. Select the class/subdivision/students as usual.
3. Select **Adaptive Assignment**.
4. Keep the maximum at 60% or choose a lower percentage.
5. Open **Build Assignment from School Question Bank**.
6. Select Subject, Medium and the Chapter/Range to be used as the adaptive scope.
7. Enter the total number of questions and language.
8. Save & Assign.

The system creates an individual assignment snapshot for each selected student. Therefore each student can receive different questions while the existing Standard Assignment remains shared exactly as before.

## Important behavior

If a student has no meaningful previous mistakes in the selected range, the system may use fewer than 60% adaptive questions. The 60% value is a maximum, not a requirement.

After a student submits a School Course assignment, the system records performance for questions that originated from the School Question Bank. These records power future adaptive assignments and the Student Performance & Struggle dashboard.

## Existing system preserved

The following are not replaced:

- Standard School Course assignment creation
- Existing manual/uploaded questions
- Existing Question Bank selection
- Existing Variation Group management
- Existing student assignment view
- Existing submission/retry rules
- Existing results and teacher controls
