# Lesson-Based Assignment Generator — Version 32

## Supabase
Run `ASSIGNMENT_SCHOOL_QUESTION_BANK_GENERATOR.sql` once in Supabase SQL Editor.

This migration adds `subject` and `medium` to `school_question_bank_questions` and indexes them for assignment filtering.

## Teacher workflow
1. Open JNVST Teacher Dashboard → New Assignment → Build Assignment from Lessons.
2. Select Subject and Medium first.
3. Only matching School Question Bank questions are eligible.
4. Select lessons/topics.
5. Mark fixed questions and/or fixed question groups (variation groups).
6. Generate the requested number of questions. Fixed questions/groups are preserved; remaining questions are random and exclude used questions and used variation groups.
7. Previously uploaded questions can be edited in Question Bank to add/change Subject, Medium, Lesson/Topic and Variation Group.

## Existing questions
Questions imported before Version 32 may have blank Subject/Medium. Edit those questions in Question Bank and assign the correct metadata before using them in lesson-based assignments.
