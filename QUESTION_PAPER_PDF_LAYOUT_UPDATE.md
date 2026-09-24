# Question Paper PDF Layout Update

Implemented in `teacher-dashboard.html`.

## Question paper
- Short header: SWARUP SIR'S KNOWLEDGE HUB, Subject, Class, Medium, Time, Full Marks.
- SECTION A contains all MCQs first.
- Section A instruction: "Choose the correct answer."
- Section A mark line is automatically `1 × N = N` where N is the number of MCQs.
- SECTION B contains all non-MCQ questions.
- Section B instruction: "Answer the following questions."
- Non-MCQ questions are sorted by marks ascending, then chapter/subchapter code ascending.
- No intermediate headings such as "2 MARK QUESTIONS" are shown.
- Marks are bold and right-aligned.
- Question images and MCQ option images remain in their stored positions.

## PDF outputs
Two separate print/PDF previews are available:
1. Question Paper PDF — questions only.
2. Model Answer Key PDF — MCQ answers plus explanation/model-answer/marking-note content for non-MCQ questions where available.

Use Print / Save as PDF in each separate preview window. Browser printing is used so Assamese/Unicode content remains safe without requiring a bundled PDF font.
