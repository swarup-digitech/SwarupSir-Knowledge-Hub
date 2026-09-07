Swarup Sir's Knowledge Hub — Complete Package

This package contains all previous functionality plus the Mock Test module.

PREVIOUS FUNCTIONALITIES
- Student-only login and separate teacher login
- Student PWA/shortcut support using the supplied SKH icon
- Student assignments with multiple attempts
- Assignment retry when the latest score is below 80%
- Multiple classes/students per assignment
- Teacher Student Accounts: Roll No, Password and Change Class

NEW MOCK TEST FUNCTIONALITY
- Student Dashboard now has a Mock Test section.
- Mock Test = 80 questions, 100 marks, 2 hours.
- 1.25 marks per question.
- Blueprint:
  MAT Pattern 4, Figure Series 4, Geometrical 4, Mirror/Water 4, Embedded 4;
  EVS MCQ 15 + EVS passage 5;
  Arithmetic 20;
  Language 4 passages x 5 = 20.
- Teacher can upload a question bank section/part wise.
- Bulk upload Type 1: Excel question-bank upload.
- Bulk upload Type 2: PDF, one question per page + Excel answer key.
- PDF pages are rendered as images and unnecessary white margins are automatically cropped.
- PDF question pages are stored in the mock-question-images Supabase Storage bucket.
- Teacher can view question-bank availability and generate a complete fixed 80-question test.
- The system randomly selects the required number from each configured part when generating the fixed test.
- Teacher can assign a generated test to multiple classes and/or selected students from multiple classes.
- Student timer is based on the saved test deadline and automatically submits when time expires.
- Student result shows overall score and section-wise breakup.

DATABASE SETUP
1. Keep using the existing SQL files for previous functionality.
2. Run multi_attempts_80_percent_retry.sql if it has not already been run.
3. Run mock_test.sql in Supabase SQL Editor.
4. Do NOT recreate the old uq_attempts_one_submission_per_student index.

MOCK QUESTION EXCEL FORMAT
Required columns:
Section | Part | Question | A | B | C | D | Answer
Optional:
Passage | Image URL

Valid Part values:
MAT_PATTERN
MAT_SERIES
MAT_GEOMETRICAL
MAT_MIRROR
MAT_EMBEDDED
EVS_MCQ
EVS_PASSAGE
ARITHMETIC
LANG_P1
LANG_P2
LANG_P3
LANG_P4

PDF + ANSWER KEY FORMAT
- PDF: exactly one complete question per page.
- Select the corresponding Part before processing the PDF.
- Answer-key Excel columns: Question No | Correct Option
- Page 1 maps to Question No 1, page 2 to 2, etc.
- Correct Option must be A, B, C or D.

IMPORTANT
- The PDF method stores the complete cropped page as an image; it does not depend on OCR, so Assamese/non-Latin text, mathematical notation and figures are preserved visually.
- The generated test stores a snapshot of each selected question, so later edits to the bank do not change an already generated test.
- The current implementation generates a fixed test (same selected 80 questions for all recipients). A per-student random version can be added later if required.
