# Final Course Question Bank Separation

## Two independent Question Banks

### JNVST Course
- Subject -> Lesson -> Sub-lesson -> Topic
- Medium (`COMMON` for MAT, `ENGLISH`, `ASSAMESE`)
- Variation Group
- Fixed Question metadata
- Used by the JNVST Teacher Dashboard and JNVST New Assignment generator
- **Stored in `public.mock_question_bank`**
- JNVST metadata columns: `subject_id`, `lesson_id`, `variation_group`, `is_fixed`

### School Course
- Subject -> Chapter -> Subchapter -> Topic
- Medium
- Variation Group
- Used by the School Teacher Dashboard and School Course assignments
- **Stored in `public.school_question_bank_questions`**
- Uses `course_type = 'SCHOOL'` for the School Course UI.

The two systems are logically separate. JNVST assignment generation does not query the School Question Bank, and School assignment generation does not query the JNVST `mock_question_bank`.

## Supabase migrations

The existing database already contains the JNVST Subject -> Lesson -> Sub-lesson tables and the JNVST `mock_question_bank` metadata columns.

For a fresh/repeatable setup, use:

1. `JNVST_MOCK_QUESTION_BANK_METADATA_MIGRATION.sql` — adds JNVST metadata and indexes to `mock_question_bank`.
2. `SCHOOL_COURSE_SEPARATION_SAFE_MIGRATION.sql` — adds the School `course_type` discriminator used by the School Question Bank UI.
3. `JNVST_ASSIGNMENT_GENERATOR_SUPPORT.sql` — adds assignment filtering indexes and an optional read-only RPC.

Do **not** use the old JNVST implementation in `school_question_bank_questions` as the JNVST source. The current application uses `mock_question_bank` for JNVST.

## JNVST question bulk upload

Use `JNVST_Question_Bank_Bulk_Upload_Template.xlsx`.

Required mapping:
- Subject Name must match an existing JNVST Subject.
- Lesson Code must match an existing JNVST Lesson/Sub-lesson.
- Medium: `COMMON`, `ENGLISH`, or `ASSAMESE`.
- Variation Group is optional.
- Fixed Question: `YES` or `NO`.

The uploader writes to `mock_question_bank` only.

## JNVST assignment generation

1. Select JNVST Subject.
2. Select Medium.
3. Only matching JNVST questions become available.
4. Select Lesson/Sub-lesson.
5. Select Fixed Questions.
6. Select Fixed Question Groups (Variation Groups).
7. Fill the remaining count randomly.
8. Exclude already selected questions.
9. Exclude all other questions in a used variation group.
10. Validate that the requested total can actually be satisfied.

## School Course

School Course continues to use the existing Chapter/Subchapter/Topic hierarchy and its existing question-bank tables. No School Course chapter/subchapter/topic data is replaced by the JNVST hierarchy.
