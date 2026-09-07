SWARUP SIR'S KNOWLEDGE HUB
MCQ-ONLY ASSIGNMENT UPDATE

1. Run mcq_assignments.sql once in Supabase SQL Editor.
2. Deploy the updated index.html to Cloudflare Pages.
3. In Teacher Dashboard choose + New Assignment.
4. Select either:
   - Video + MCQ
   - MCQ Only — No Video
5. Enter an Assignment Group name. Use the same group name for related Video + MCQ and MCQ Only assignments.
6. For MCQ Only, upload either:
   - Excel containing Question, Option A, Option B, Option C, Option D, Answer
   - PDF with one question per page + Answer Key Excel
7. PDF pages are rendered as images and automatic white margins are cropped before storage.
8. Assign to an entire class or selected students.
9. Students directly answer MCQs for MCQ-only assignments; no video screen is shown.
10. The existing 80% rule is retained: >=80% completes the assignment; below 80% permits another attempt while preserving history.
11. Teacher Results now show each student's wrong/unanswered questions, selected answer, and correct answer. Full question text/image is available.
12. Existing assignments default to Video + MCQ when assignment_type was previously absent.

IMPORTANT:
- The SQL migration must be run before creating MCQ-only assignments.
- Existing assignments are not deleted or changed except that their type is explicitly marked video_mcq when missing.
- The MCQ-only image bucket is assignment-question-images.

PACKAGE SAMPLE FILES:
- MCQ_Only_Assignment_Template.xlsx
- MCQ_Only_Answer_Key_Template.xlsx
- mcq_only_sample_questions.pdf
