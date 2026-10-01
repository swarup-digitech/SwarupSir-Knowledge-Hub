# Final Course Question Bank Separation

## Two independent Question Banks

### JNVST Course
- Subject -> Lesson -> Sub-lesson -> Topic
- Medium
- Variation / Fixed Question Group
- Used by JNVST Teacher Dashboard and JNVST `Build Assignment from Lesson`.
- Stored with `course_type = 'JNVST'`.

### School Course
- Subject -> Chapter -> Subchapter -> Topic
- Medium
- Variation Group
- Used by School Teacher Dashboard and School Course assignments.
- Stored with `course_type = 'SCHOOL'`.

The two banks are filtered by `course_type` and are not displayed in each other's management screens.

## Supabase
Run `COURSE_QUESTION_BANK_SEPARATION_MIGRATION.sql` once after the existing question-bank and JNVST lesson migrations.

It:
1. Adds `course_type`.
2. Classifies existing questions with JNVST subject/lesson metadata as JNVST.
3. Keeps other existing questions as School Course.
4. Allows JNVST questions to have no School Course chapter.

Alternatively, use the updated `complete_database_migrations.sql` for the combined feature migrations.

## JNVST lesson bulk upload
Use `JNVST_Lesson_Sublesson_Bulk_Upload_Template.xlsx` from the JNVST Teacher Dashboard.

## JNVST question bulk upload
Use `JNVST_Question_Bank_Bulk_Upload_Template.xlsx`.

Required mapping:
- Subject Name must match an existing JNVST Subject.
- Lesson Code must match an existing JNVST Lesson/Sub-lesson.
- Medium: ENGLISH / ASSAMESE / BOTH.
- Variation Group is optional and groups similar questions.

## School Course
Use `Question_Bank_Chapter_Bulk_Upload_Template.xlsx` and the School Teacher Dashboard Question Bank tools.

## Assignment generation
JNVST assignment generation:
1. Select JNVST Subject.
2. Select Medium.
3. Select Lesson/Sub-lesson.
4. Select Fixed Questions.
5. Select Fixed Question Groups.
6. Fill the remaining count randomly.
7. Exclude already selected questions and used variation groups.

School Course assignment generation uses the School Question Bank and Chapter/Subchapter hierarchy separately.
