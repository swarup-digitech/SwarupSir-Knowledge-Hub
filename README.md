# JNVST Mock Test – final files (cumulative, teacher-app.js?v=74)

## 1. Supabase – run in this order (SQL Editor; all safe to re-run)
1. sql/1_V38_MOCK_EXAM_LOCK.sql      – online exam lock, auto-submit, "left test" log
2. sql/2_V40_MOCK_BILINGUAL_SETS.sql – pen-paper sets (A–D, English + Assamese) and OMR import (includes the earlier V37 migration)
3. sql/3_V47_MOCK_RESULT_REVIEW.sql  – result review with explanations
4. sql/4_V48_PAPER_MOCK_RESULTS.sql  – OMR import also creates the student's Mock Test result
5. sql/5_V49_PAPER_RESULTS_BACKFILL.sql – results for students imported earlier
6. sql/6_V51_EDIT_MOCK_KEY.sql       – edit the answer key and re-mark results
7. sql/7_V52_EDIT_STUDENT_ANSWERS.sql – correct one student's misread answers
8. sql/8_V53_DELETE_MOCK_OMR.sql – delete imported OMR results (whole exam or one student) to re-import

## 2. Upload main.html and teacher-app.js (replace both).

## 3. What is in this build
- Online Mock Test: maths (fractions etc.) in questions AND options now renders for students; no back/exit, continuous server timer, warnings, auto-submit; 20 questions per part (1.25 marks)
- Pen-paper Mock Test: 4 sets x English + Assamese, new first page, medium, Assamese directions, A4 safe margins + staple margin, MathJax, no blank pages
- Answer key PDF/Excel (English and Assamese keys may differ); OMR import picks booklet by set + language (-E / -A after exam code)
- Mock Tests > Previous: "View Results" (online and pen-paper) so teacher sees every student's response + review BEFORE approving; "Approve / Hide Results" for pen-paper sets
- OMR import: if the key read by the OMR software differs from the saved key, a table lists those questions; per question choose Use saved key (default) / Use key from file (updates saved key and re-marks) / Skip question
- 📽 Discussion PDF on the pen-paper exam card (one page per question, set-wise numbers, option counts, who was wrong/skipped, explanation) - needs omr-discussion.js already in your app
- 🗑 Delete OMR import (exam card, or per student in View Results) then import again
- ✎ Correct this student's answers (Results > View Response, pen-paper) when OMR misread a sheet
- ✎ Edit Key on every pen-paper exam card and every online test card: correct wrongly read answers per Set/language; all scores re-marked
- Student result page: score card + Review (Wrong / Correct / Unanswered / All) with correct answer and explanation
- Fee details download (students with fees paid and dues)

## 4. Notes
- Test with one student first: create a pen-paper test, import a small OMR file, View Results, Edit Key, Approve Results, open the student's result.
- Edit Key changes the Mock Test's copy of the key only (not the Question Bank). Mistake Bank entries already created from an OMR import are not re-written.
- If your live teacher-app.js has extra code (e.g. the "Re-generate results" button) that is not in this build, merge it before replacing.
