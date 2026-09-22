# Mock Test Result: Student View & Download

## Behaviour

- A student can see a submitted Mock Test result only after the teacher sets **Approve Results** / `results_released = true` for that Mock Test.
- Before approval, the student sees the existing message that the result is waiting for teacher approval.
- After approval, the student sees **View Result** and **Download Result Sheet**.
- The downloadable PDF uses the same result-sheet design as the teacher PDF.
- The PDF contains:
  - Student details
  - Overall score
  - Subject-wise performance
  - Question No.
  - Original Answer Key
  - Student's Answer
- Wrong student answers are highlighted in red; correct answers are green; unanswered responses are shown as —.
- The PDF does not include question text, options, explanations, or images.

## Deployment

No new SQL migration is required. The existing `mock_tests.results_released` field controls release.

Deploy the updated `main.html` after the existing Mock Test result-approval migration has been applied.
