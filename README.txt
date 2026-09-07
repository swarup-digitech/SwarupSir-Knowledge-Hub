SWARUP SIR'S KNOWLEDGE HUB — COMPLETE PACKAGE
==============================================

This package includes the previous Knowledge Hub functionality plus the expanded Mock Test question-bank system.

PREVIOUS FUNCTIONALITY
----------------------
- Student-only login page and separate Teacher Login.
- Student PWA/shortcut support using the supplied SKH icon.
- Assignment submission history and retry when the latest score is below 80%.
- Multiple classes/students can be assigned to an assignment.
- Teacher Student Accounts: view/change Roll No, Password and actual Class membership.
- Existing assignment result/previous-work functions.

MOCK TEST BLUEPRINT
-------------------
- 80 questions, 100 marks, 1.25 marks each.
- 2 hours (120 minutes).
- MAT Q1-20: five parts, 4 questions each.
- EVS Q21-40: 15 MCQs + one passage followed by 5 questions.
- Arithmetic Q41-60: 20 questions.
- Language Q61-80: four passages, 5 questions each.
- The supplied MAT Part III numbering is corrected to Q9-12 so all five MAT parts contain four questions.

QUESTION BULK UPLOAD
--------------------
General rule: every question bank has a 'required questions per set' value. A bulk upload is accepted only when the uploaded amount is a multiple of that value. The rule is checked separately for each Part/Question Bank in an Excel file.

Examples:
- MAT Pattern Completion: 4 per set -> 4, 8, 12, 16... questions.
- EVS MCQ: 15 per set -> 15, 30, 45... questions.
- Arithmetic: 20 per set -> 20, 40, 60... questions.
- Passage banks: one complete passage group is the unit; each group contains exactly 5 linked questions.

1) EVS + LANGUAGE: Excel upload.
   - Normal questions can be entered in the Questions sheet.
   - Passage groups use two sheets: Passages and Questions.
   - Create one Passage ID in Passages and link exactly five questions to the same Passage ID.
   - Multiple complete passage groups can be uploaded in one file.
   - Image URL is optional; images can also be added later from Manage Question Bank.

2) MAT + ARITHMETIC: PDF + Answer Key Excel.
   - One complete question per PDF page.
   - Upload any multiple of the required questions-per-set for the selected bank.
   - Each page is rendered as an image in the browser.
   - Unnecessary white margins are automatically cropped.
   - Answer Key Excel maps PDF page/question number to A/B/C/D.
   - The PDF upload is restricted to MAT and Arithmetic parts.

IMAGES LATER
------------
- EVS and Language questions may be uploaded without images.
- From Manage Question Bank, the teacher can edit a question and add/replace an image later.
- Generated mock tests copy the current bank question data at generation time, so later bank edits do not change an already generated test.

QUESTION BANK MANAGEMENT
------------------------
Teacher > Mock Test Management > Manage Question Bank
- Edit question text/options/correct answer.
- Change the question's part.
- Edit passage title/text.
- Add/replace an image.
- Activate/deactivate questions.
- Delete questions.
- See active-question counts against the required blueprint.

TEST GENERATION
---------------
- The system requires enough active questions in every blueprint part.
- It randomly selects the required count from each part.
- It creates a fixed 80-question test; assigned students receive the same generated test.
- The teacher assigns the generated test to multiple classes and/or selected students.

DATABASE SETUP
--------------
Run mock_test.sql in Supabase SQL Editor after the existing assignment/retry database setup.
The SQL is safe to re-run and adds passage metadata columns to the mock question bank.

Also continue to use multi_attempts_80_percent_retry.sql for the assignment retry feature.
Do NOT recreate the old uq_attempts_one_submission_per_student unique index.

STORAGE
-------
mock_test.sql creates the public Supabase storage bucket: mock-question-images.
It is used for cropped PDF question pages and later-added question images.

DEPLOYMENT
----------
- Replace the frontend files in your Cloudflare Pages project with the package files.
- Deploy the updated create-students.ts as the create-students Supabase Edge Function.
- Run the SQL files in Supabase SQL Editor.
- After deployment, clear/reinstall the old student PWA shortcut if an old cached version appears.

TEMPLATES
---------
- mock_question_bank_template.xlsx: Questions + Passages + Instructions sheets.
- mock_answer_key_template.xlsx: Answer Key + Instructions sheets.

IMPORTANT
---------
For PDF upload, the complete question (including diagrams/options) should be on one page. The application stores the cropped page as the question image; OCR is not required.
