# Submission Rule Update — One Submission Until Teacher Re-assignment

## New rule

For MCQ assignments:

1. A student can submit the current assignment attempt only once.
2. A second click / simultaneous request is rejected by the database.
3. The Submit button is immediately disabled after the first click.
4. A student cannot start the submitted assignment again.
5. A teacher can explicitly re-assign a submitted student.
6. Re-assignment increments `current_attempt_number` and opens exactly one new attempt.
7. Previous submitted attempts are retained for teacher history.
8. The automatic "below 80% after 3 hours" retry is preserved.

## Important database step

Run this file once in Supabase SQL Editor:

`single_submission_until_reassigned.sql`

Run it on the current database before testing the new frontend.

The migration:
- adds `assignment_students.current_attempt_number`
- removes the obsolete `(assignment_id, student_id)` unique index
- cleans accidental duplicate submissions that occurred within 5 seconds
- backs cleaned rows into `attempts_duplicate_cleanup_backup` and
  `answers_duplicate_cleanup_backup`
- normalizes historical `attempt_number` values
- creates the database-level unique constraint on
  `(assignment_id, student_id, attempt_number)`
- creates the teacher re-assignment RPC
- preserves and schedules the old below-80% / 3-hour low-score retry

## Deployment

Replace the deployed project files with the updated project.

The following important files were changed:

- `main.html`
- `sw.js`
- `student-sw.js`
- `single_submission_until_reassigned.sql`
- `automatic_low_score_reassignment.sql`
- `one_submission.sql`
- `multi_attempts_80_percent_retry.sql`
- `complete_database_migrations.sql`
- `README.txt`

## Test

### Test 1 — Double click

1. Assign an assignment to one student.
2. Student completes it.
3. Click Submit rapidly twice.
4. Expected: exactly one attempt in the database and one row in teacher Results.

### Test 2 — Refresh / reopen

After submission, refresh the student page and open My Assignments.

Expected:
- assignment appears under Completed Assignments
- Start Assignment is not available
- opening the assignment again is blocked

### Test 3 — Teacher re-assignment

Teacher → Assignment → `Assign / Reassign`.

Select the already submitted student and save.

Expected:
- the student's current attempt number changes from 1 to 2
- the assignment becomes available again
- the student can submit exactly once more
- the teacher Results page can show Attempt 1 and Attempt 2 as separate historical submissions

### Test 4 — Pending student

If a student has been assigned an assignment but has not submitted it, re-assigning the assignment does NOT create another attempt. The student keeps the existing pending assignment.

## Existing duplicate cleanup

The migration is intentionally conservative: it treats submissions for the same student and assignment occurring within 5 seconds as accidental duplicates.

The removed records are copied into backup tables before deletion.

Make a normal Supabase database backup before running the migration as an additional safety measure.

### Test 4 — Automatic below-80% retry

1. Submit an assignment with a score below 80%.
2. The student remains blocked from a second submission immediately after submitting.
3. After the submission is at least 3 hours old, the scheduled job checks every 5 minutes.
4. The low-score submission is removed and the assignment becomes available again.
5. A score of exactly 80% or higher is not automatically reset.

### Test 5 — Teacher re-assignment

A teacher can re-assign a submitted student before the automatic retry. This opens a new attempt immediately. The one-submission protection still applies to that new attempt.
