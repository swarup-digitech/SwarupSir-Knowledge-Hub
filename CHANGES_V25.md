# V25: Free ways to pair and translate questions (no Claude API key needed)

Two additions to **JNVST Question Bank → 🌐 Check missing translations**. Neither needs a paid key or anything
new in Supabase.

Changed files: `bilingual-papers.js`, `main.html`. No SQL to run.
Upload both files and press Ctrl+Shift+R.

## 1. "Same numbers" pairs (automatic, free)
An English question and its Assamese version contain the same numbers. The **🔗 Suggested pairs** tab now also
lists **Same numbers** pairs when all of these hold:
* same subject and part, and the same correct answer;
* the question contains the same numbers;
* each option A, B, C, D contains the same numbers. Assamese digits ০-৯ count as 0-9.

The lesson, topic or upload date may differ. At least 3 numbers are needed, so questions without numbers are
not paired this way. Each match must be unique: if two English questions share the same numbers, neither is
suggested.

Use **🔗 Link all … same-numbers pairs** after looking through them, or **🔗 Link** one by one.
Passages are matched the same way: numbers in the passage and in all 5 questions.

## 2. Excel round trip for the rest
* **⬇ Export missing questions (Excel)** exports the questions that still have no partner, for the chosen
  Subject (or all subjects). There is one row per question:
  * the existing text and options;
  * which language to translate into;
  * empty **→ … (translation)** columns.

  A second sheet explains how to fill the file.
* Fill the **→** columns any way you like:
  * yourself, or a teacher who knows both languages;
  * Google Translate (it supports Assamese; check the maths terms);
  * Claude chat: upload the file there, or send it to me in this conversation, and ask for the → columns to
    be filled.
* **⬆ Import translations (Excel)** reads the file back and shows a preview.
  * **Warnings** for: numbers that differ from the original, empty options, wrong script.
  * **Skipped:** empty rows, questions that were linked meanwhile, and incomplete passages.
  * **💾 Add and link** creates the new questions and links each to its source. The answer, picture, subject,
    lesson, topic and variation group are copied.
  * Tick **Mark as "Auto-translated — to check"** if the text came from a machine. This needs the V24 SQL; leave
    it unticked otherwise.

### Rules for filling the file
* Keep numbers, units and maths (`$…$`, `\frac{..}{..}`) exactly. Keep the options in the same order.
* For a passage, fill the translated passage title and text on its first row, and all its questions.
* For a picture question whose picture needs no translation, write `SAME` in **→ Question**.
* Do not change the **Question ID** or **Passage key** columns.

## Tested
In a test browser with simulated data:
* The English apple question was paired with its Assamese version written with Assamese digits. A look-alike
  with different numbers was not paired.
* Export: 9 rows with the right target languages.
* Import: 7 filled rows added and linked with the answers copied; the empty row skipped; a changed number flagged
  before saving.
* EVS passage: exported, filled and imported as one Assamese passage, with each question linked by order.
* All earlier tests (V22 speed, V23 bilingual papers, V24 Claude screens) still pass.
