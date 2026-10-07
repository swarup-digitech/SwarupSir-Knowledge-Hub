# School Course Subject Management

This is an additive School Course feature. JNVST subjects remain separate.

## One-time database migration

Run `SCHOOL_SUBJECT_MANAGEMENT_MIGRATION.sql` once in the Supabase SQL Editor.

The migration:

- creates `school_subjects` per teacher;
- creates the default `Mathematics` subject for existing School teachers/data;
- assigns **all existing School Question Bank questions** to Mathematics;
- assigns existing School Question Bank chapters to Mathematics;
- adds subject references to School assessments and School assignments;
- keeps the old text `subject` values for backward compatibility;
- adds indexes and teacher-only RLS policies.

## Subject management

Teacher Dashboard → **📚 Subjects**

Teachers can:

- add subjects;
- edit subject name/code;
- activate/deactivate subjects.

## School modules using the same subject list

- School Question Bank
- Add/Edit School Question
- Chapter/Subchapter Manager
- Bulk Question Upload
- Bulk Chapter Upload
- Generate Question Paper
- New School Assessment
- Edit School Assessment
- Create School Assignment
- Edit School Assignment
- School Question Bank Assignment Builder

JNVST Subject/Lesson management is not changed.

## Existing data

All existing School Question Bank questions are intentionally categorized as **Mathematics** by the migration, as requested. New questions must select a School Subject.
