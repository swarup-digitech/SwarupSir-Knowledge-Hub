# Assignment Submission UI Update

Implemented without changing the existing database or the automatic below-80% / 3-hour retry rule.

## New submission behavior

- **80% or higher:** the student sees only a successful-submission confirmation with the score. No answer-key/review button is shown from the submission screen.
- **Below 80%:** the student is told that the assessment must be redone after the 3-hour waiting period. During the waiting period, the student can open **View Result & Answers** and see the result, selected answers, answer key, explanations and solution videos when available.
- The existing database job still removes below-80% attempts after 3 hours, making the assignment available again.
- Scores of exactly 80% are treated as successful and are not reset.

## Answer-review appearance

The review now follows the requested option-row style:

- Wrong selected option: red border/background and `✗ Your answer`
- Correct answer: green border/background and `✓ Correct answer`
- If the student's answer is correct: the selected option is green and marked `✓ Your answer / Correct`
- The review also shows `Your answer` and `Correct answer` below the options.

Updated files:
- `main.html`
- `index-multi-class.html`
