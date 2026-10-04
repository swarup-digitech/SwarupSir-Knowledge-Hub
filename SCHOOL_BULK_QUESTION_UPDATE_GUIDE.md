# School Course — Bulk Question Update / Upload

## 1. Run the database migration once

In Supabase SQL Editor, run:

`school_question_bank_textbook_latex_upgrade.sql`

It adds:
- `text_book` — TRUE/FALSE
- `textbook_reference` — optional source details

## 2. Download the Excel template

Use **Question_Bank_Bulk_Excel_Template.xlsx** from the School Teacher Dashboard.

Important columns:
- `English Question`
- `Assamese Question`
- `Option A English` ... `Option D Assamese`
- `Explanation`
- `Text_Book` — `YES` or `NO`
- `Textbook_Reference` — e.g. `NCERT Class 8, Ch 3, Ex 3.2, Q5`

## 3. Enter mathematics in Excel

You can enter raw LaTeX directly:

- `\\frac{3}{4}`
- `x^2`
- `\\sqrt{25}`
- `\\times`
- `\\div`

You can also use explicit MathJax delimiters:

- `$\\frac{3}{4}$`
- `\\(x^2+5\\)`

The importer converts the mathematical content into MathJax-ready text. The question preview shows the rendered mathematics before import.

## 4. Textbook source

Use:

`Text_Book = YES`

when the question is taken from the textbook.

Use:

`Text_Book = NO`

for a teacher-created/reference question.

For precise source tracking, fill `Textbook_Reference`, for example:

`NCERT Class 6, Chapter 7, Exercise 7.1, Question 3, Page 142`

## 5. After import

The School Question Bank displays a **Text_Book** column and provides a filter:

- Textbook: All
- Textbook: YES
- Textbook: NO

The Edit Question screen also allows the teacher to change the textbook status/reference.
