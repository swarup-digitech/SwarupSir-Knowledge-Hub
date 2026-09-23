# Question Bank Implementation

Added to `teacher-dashboard.html`:
- Question Bank and Generate Paper buttons.
- Chapter management.
- Bilingual English/Assamese question editor.
- Ordered text/image blocks with move up/down controls.
- Teacher image upload to `school-question-bank-images`.
- MCQ/Short/Long, marks, cognitive level, difficulty.
- Bilingual MCQ options and correct-answer flag.
- Paper generator with total marks and cognitive distribution.
- Best-fit subset selection when exact mark combinations are unavailable.
- Paper language: English, Assamese, or English + Assamese.
- Print/Save as PDF preview using the browser, which preserves Assamese Unicode fonts.
- Answer key for MCQs.

Run `school_question_bank_migration.sql` in Supabase before using the new Question Bank.
