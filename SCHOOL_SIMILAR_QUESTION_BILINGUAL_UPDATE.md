# School Course — Similar Question / Bilingual Variation Update

Implemented in `teacher-dashboard.html` and `_teacher_inline.js`.

## Behaviour
- Available only from the School Course Question Bank Edit Question screen.
- Adds **Generate Similar Question**.
- Copies all School Question Bank fields, including English and Assamese text, options, explanations, image blocks and MathJax/LaTeX content.
- Opens the copied data as a new-question editor; saving creates a new question and never updates the source question.
- If the source question has no `variation_group`, the system creates one and assigns it to the source before creating the variation.
- The new question uses the same variation group as the source.
- English + Assamese can be edited together in the same form.
- Medium is preserved/derived for bilingual content, including bilingual MCQ options.
- JNVST Question Bank code/path was not changed.

No additional database migration is required because the supplied School Question Bank schema already contains `variation_group`.
