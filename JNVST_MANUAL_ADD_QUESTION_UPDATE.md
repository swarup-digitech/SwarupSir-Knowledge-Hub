# JNVST Manual Add Question Update

Implemented in `main-inline.js`.

## Added
- `➕ Add JNVST Question` button on the JNVST teacher dashboard, JNVST Question Bank, and JNVST question-management screens.
- Manual question creation with Subject, Lesson/Sub-lesson, Part, Topic, Variation Group, Question Type, Marks, Cognitive Level, Difficulty and Fixed/Mandatory flag.
- English + Assamese bilingual creation as two linked `mock_question_bank` records using `language_pair_id`.
- Common (MAT) mode for one COMMON record.
- Four MCQ options, separate correct answer and explanation for each language.
- Optional question/diagram image upload.
- Optional passage metadata for EVS/Language passage parts.
- Duplicate detection before insertion.
- Save & Add Another workflow.
- Existing School Course question bank is not modified.

No new database migration is required because the existing `JNVST_BULK` source type is reused for manually-created JNVST rows, while bilingual linkage uses the existing `language_pair_id` column.
