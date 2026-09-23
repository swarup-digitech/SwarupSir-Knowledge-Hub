# Question Bank Bulk Upload — Setup

The School Teacher Dashboard now includes **Question Bank → Bulk Question Upload** with three methods:

1. **Excel** — one question per row, bilingual English/Assamese, MCQ options A-D, answer, explanation, marks, cognitive level and difficulty.
2. **Word (.docx)** — structured `[QUESTION] ... [/QUESTION]` blocks using the supplied Word template.
3. **PDF + Metadata Excel** — one complete question per PDF page. Pages are rendered directly as images; **no OCR** is used. Metadata Excel supplies chapter, type, marks, cognitive level, difficulty and correct answer.

## Supplied templates

- `Question_Bank_Bulk_Excel_Template.xlsx`
- `Question_Bank_Bulk_Word_Template.docx`
- `Question_Bank_Bulk_PDF_Template.pdf`
- `Question_Bank_Bulk_PDF_Metadata_Template.xlsx`

## Supabase

Run `school_question_bank_bulk_upgrade.sql` once after `school_question_bank_migration.sql`. It adds `correct_answer` to the Question Bank question table so MCQ answers from Word/PDF uploads can be retained even when the options are part of a PDF image.

## Important PDF rule

Use exactly **one complete question per PDF page**. Keep the question text, diagram and visible MCQ options on that page. The PDF uploader does not OCR the page.
