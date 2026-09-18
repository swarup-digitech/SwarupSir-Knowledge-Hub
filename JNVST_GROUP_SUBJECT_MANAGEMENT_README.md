# JNVST Group & Subject Management Update

This package updates the JNVST Teacher Dashboard.

## Assignment structure
- Fixed main groups: JNVST-VI (Class-IV) and JNVST-IX (Class IX).
- Teacher can create additional main groups.
- Each main group can have multiple sub-groups.
- An assignment can be assigned to:
  - an entire main group,
  - one sub-group,
  - multiple sub-groups,
  - or selected individual students within selected groups.
- Duplicate recipients are automatically removed.

## Subjects
The dashboard now has a teacher-managed subject catalogue.
The four requested subjects are seeded:
1. Mental Ability
2. EVS
3. Arithmetic
4. Language

Teachers can create additional subjects and delete unused subjects.

## Deletion protection
- Fixed JNVST-VI and JNVST-IX cannot be deleted.
- A main group cannot be deleted while it has sub-groups, students, or assignments.
- A sub-group cannot be deleted while it has students or assignments.
- A subject cannot be deleted while it is used by an assignment.
- Every actual deletion requires a confirmation warning.
- Assignment deletion uses the existing permanent-delete confirmation and removes related questions, recipients, attempts and answers.

## Supabase migration
Run `JNVST_GROUP_SUBJECT_MANAGEMENT.sql` once in the Supabase SQL Editor before using the new group/subject management functions.

If the existing installation has not yet been initialized for the fixed JNVST groups, run `JNVST_FIXED_CLASSES_SETUP.sql` as well.

No existing student/assignment data is intentionally discarded by this update.
