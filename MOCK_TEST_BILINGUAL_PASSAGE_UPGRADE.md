# Mock Test Management — Bilingual + Complete Passage Upgrade

## Database
Run `JNVST_MOCK_METADATA_BILINGUAL_PASSAGE_UPGRADE.sql` once in the Supabase SQL Editor.

It adds/ensures:
- Lesson Code
- Topic
- Variation Group
- Fixed Question
- Question Type
- Marks
- Cognitive Level
- Difficulty
- JNVST Subject/Lesson links
- English/Assamese language-pair linkage
- passage/entity indexes

Existing `mock_question_bank` rows are preserved.

## Excel upload
The updated Mock Test Excel template supports one row containing both:
- Question English + Question Assamese
- Option A-D English + Option A-D Assamese

For EVS and Language passages:
- use one Local Passage No. for the group
- use Question Order 1, 2, 3, 4, 5
- put the English and Assamese passage in the Passages sheet

Each language is stored as its own question-bank version, linked with `language_pair_id`.

## Passage display
EVS passage + five questions are treated as one complete entity. In Mock Question Bank management and the question-paper selection screens, the complete passage is shown first, followed by all five questions and their options.

Deleting or activating/deactivating a passage question operates on the complete five-question entity so an incomplete passage group is not accidentally created.
