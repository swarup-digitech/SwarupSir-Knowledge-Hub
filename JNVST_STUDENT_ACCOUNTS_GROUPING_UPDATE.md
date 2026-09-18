# JNVST Student Accounts – Main Group / Sub-group Update

The JNVST Teacher Dashboard Student Accounts page now:

- displays students grouped and sorted as **Main Group → Sub-group → Student name**;
- uses the actual `class_students` membership and JNVST `classes` parent relationship;
- keeps `JNVST-VI (Class-IV)` and `JNVST-IX (Class IX)` separate;
- shows `Navodaya_Ass` and `Navodaya_Eng` under their correct parent group;
- lets a teacher move a student between sub-groups under the same main group;
- asks for confirmation before moving the student;
- keeps Roll No unchanged;
- keeps the existing password and delete actions.

## Required deployment

Deploy the updated `supabase/functions/create-students/index.ts` (or the matching `create-students.ts` source) because the new Student Accounts page calls the `setStudentJnvstSubgroup` Edge Function action.

No additional database table is required. The move changes the existing `class_students` membership from the old sub-group to the new sub-group.

The Edge Function verifies that:

1. the caller is a teacher;
2. both groups belong to that teacher;
3. both groups are JNVST sub-groups;
4. both sub-groups belong to the same main group; and
5. the student is currently a member of the selected source sub-group.
