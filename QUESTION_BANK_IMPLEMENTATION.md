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


## School Course Paper Generator — Constraint Upgrade
- Chapter-wise minimum and maximum marks can be configured for every main chapter; subchapter questions count toward the parent chapter.
- Teacher can select fixed questions that must be included in the generated paper.
- Question Bank questions support an optional `Variation Group`; the generator allows at most one question from a variation group.
- Default cognitive blueprint is Knowledge 30%, Understanding 30%, Application 20%, HOTS 20%.
- The generator enforces total marks, fixed-question constraints, chapter minimum/maximum marks, variation-group exclusivity, and the selected question-type filter.
- Because question marks are whole numbers, exact cognitive percentages can be mathematically impossible for some paper totals (for example, 45 marks with 30/30/20/20 gives 13.5/13.5/9/9). In such cases the generator uses the nearest feasible mark combination and reports the actual cognitive distribution.
- Run `school_question_paper_generator_upgrade.sql` once after the existing Question Bank migrations.
