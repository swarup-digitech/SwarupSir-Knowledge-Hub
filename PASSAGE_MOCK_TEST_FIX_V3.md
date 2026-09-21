# Mock Test Passage Fix V3

## Fixed

1. Language Mock Test blueprint is now **4 passage groups × 5 questions = 20 questions**.
2. The generated-test validation now therefore expects 20 Language questions, not 5.
3. EVS remains 1 passage group × 5 questions.
4. Generated `mock_test_questions` now snapshot `passage_id`, `passage_title`, and `passage_text`.
5. The same correction is applied to `index-multi-class.html` so the alternate/mock-test page cannot reintroduce the old 5-question expectation.

## Why the error occurred

The first passage implementation correctly defined each Language passage as 5 questions, but the blueprint's `count` was accidentally left as 5 while `groupCount` was 4. The generator selected four complete passage groups (20 questions) and then compared them against `count=5`, producing:

> Language — 4 Passage Groups: selected groups must contain exactly 5 questions.

`count` now represents the total questions contributed by that blueprint item: 20 for Language, while `passageCount` remains 5 per passage.
