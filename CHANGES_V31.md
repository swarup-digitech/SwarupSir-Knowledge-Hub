# V31: Explanations in the student's Assignment Result

In **View Result & Answers**, every question now shows its **Explanation** (below Correct ✓ / Wrong ✗) whenever one exists.

Why it was missing: personal papers (🎯 Custom Adaptive) and some question-bank assignments are saved without the explanation;
it stays in the question bank, which students cannot read. Now the review takes the **current** explanation from the bank:
* JNVST question bank: an English question gets the English explanation. An Assamese question gets the Assamese
  explanation (or the English one if no Assamese explanation exists). A Common (MAT) question gets both, one under the other.
* School question bank: its explanation.
* An explanation typed for the assignment itself (✎ Edit / 📖 Add Explanation) always wins.
* Corrections you make later in the question bank are shown to students automatically.
* Scheduled assignments (V30): as before, students see the answers and explanations only after you publish the results.

## Install
1. Supabase → SQL Editor: run **`V31_REVIEW_EXPLANATIONS.sql`** (after V30). It shows `V31 review explanations installed`.
2. Upload **`main.html`** (the explanation keeps its line breaks). Press Ctrl+Shift+R.

## Tested (PostgreSQL 16)
English, Assamese, Common (both languages) and School explanations come from the bank. A teacher's own explanation is
kept. A question without any explanation shows none. Before publishing, the answers stay locked. The SQL can be run twice.
