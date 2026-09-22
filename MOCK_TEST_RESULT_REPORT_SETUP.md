# Mock Test Result Report

Implemented teacher-side Mock Test response viewing and PDF report generation.

## Teacher workflow

Teacher Dashboard → Mock Test Results → View Response / PDF

## PDF contents

- Student details
- Overall score
- Subject-wise performance
- Question No.
- Original Answer Key
- Student's Answer
- Wrong student answers highlighted in red
- Correct student answers highlighted in green
- Unanswered shown as —
- Page numbering and footer

The detailed PDF deliberately does **not** include question text, options, explanations, or images in the question-wise answer sheet.

## Deployment

No SQL migration is required for this feature. The existing Mock Test tables contain the required question snapshots, answer keys, attempts and student answers.

`main.html` now loads jsPDF and jsPDF-AutoTable from jsDelivr and generates the report in the teacher's browser.
