# JNVST Lesson/Sub-lesson Bulk Upload

## Excel columns
- Subject Name — must match an existing JNVST subject.
- Lesson Code — unique within the subject; examples `1`, `1.1`, `1.2`.
- Lesson Name — required.
- Parent Lesson Code — blank for a top-level lesson; parent code for a sub-lesson.
- Description — optional.

## Behaviour
1. Teacher opens **Manage JNVST Groups & Subjects**.
2. Clicks **Bulk Upload Lessons / Sub-lessons** or **Excel Template**.
3. Uploads the workbook.
4. The browser validates all rows before import.
5. Existing Subject + Lesson Code combinations are skipped rather than duplicated or overwritten.
6. New rows are inserted parent-first, so parent and child rows can be in the same workbook.
7. Questions are not changed by this import. Existing Question Bank categories remain intact.
8. After import, Question Bank questions can be edited and assigned to the new JNVST Subject and Lesson/Sub-lesson.
