# V29: Download questions for editing, then re-upload (English + Assamese together)

Download questions from the JNVST Question Bank as Excel, edit them, and upload the file again. The **same questions
are updated in place**, English and Assamese together. Nothing is duplicated.

## Where
**Admin – 📚 JNVST Question Bank**
* **⬇ Download for Editing (Excel)** (next to *📽 Discussion PDF*): downloads the ticked questions. If nothing is ticked,
  it downloads every question that matches the filters.
  * The other-language version is **always added automatically**. Tick only the English question and its Assamese
    version comes on the same row.
  * Ticking one question of a passage brings the whole passage (5 questions) in both languages.
* **⬆ Re-upload Edited Excel** (next to *⬇ Excel Template*): choose the edited file → see every change → **✓ Apply changes**.

## The Excel file
* Same columns as the Bulk Upload template: English and Assamese questions, options, passages and explanations on ONE row.
* Three extra columns at the end:
  * **Record ID English** and **Record ID Assamese**. Do not change these. They tell the app which saved question each
    row is, so you can sort or filter rows freely.
  * **Check**: information only, never saved. Examples: *No Assamese version in the bank*, *English and Assamese differ
    in Correct Answer*, *Has a picture*.
* Every cell is stored as text, so `0.50`, `1/2` or `007` stay exactly as you typed them.

## Re-upload rules
* Only cells you **changed** are saved. Unchanged rows are not touched.
* Language text (question, options A–D, passage, explanation) is saved to that language's question.
* Shared fields are saved to **both** versions: Topic, Variation Group, Difficulty, Cognitive Level, Marks,
  Correct Answer, Fixed, Common, and Subject/Lesson Code.
* **Passage:** the title and text are on the Question Order 1 row. A change there is saved to all 5 questions.
  Changing the Lesson Code of a passage moves the whole passage, in both languages.
* **Missing language:** type the Assamese (or English) text into the empty columns of a row. It is added as a new
  question linked to that row's question, with the same lesson, topic, answer and picture. Not available for passages.
* **English–Assamese link:** old bulk uploads saved the two versions *without* a link, so the app matches them
  automatically: same upload, same lesson, part and variation group, plus the explanation, numbers and answer.
  If the match is not certain, the two versions are put on separate rows and the Check column says so.
  To pair them yourself, paste the Assamese Record ID into the English row and delete the Assamese row.
  On re-upload, *Also save the English–Assamese link* (ticked by default) saves the link permanently.
* **Ignored, with a note:** changes to Part, Medium, Question Type, Local Passage No. and Question Order; rows without
  a Record ID (use 📥 Bulk Upload for new questions); deleted rows (nothing is deleted).
* **Blocked until fixed:** unknown or duplicated Record IDs, Correct Answer not A–D, invalid Marks/Difficulty/YES-NO,
  an unknown Lesson Code, or an empty question text. Nothing is saved while any of these remain.
* Assamese explanations follow the V20 rules: if the English explanation is changed, an automatic Assamese translation
  is made again, while a checked (REVIEWED) Assamese explanation is kept. If the Assamese explanation is changed, it is
  marked as checked.
* Every update is limited to your own questions (`teacher_id`).

## Install
Upload `jnvst-qb-excel.js` (new) and `main.html` (now loads `jnvst-qb-excel.js?v=1` after `teacher-portal.js`).
Press Ctrl+Shift+R. No SQL.

## Tested
Tested in Chromium with 32 mock questions:
* Bulk-uploaded unlinked pairs, linked pairs, a bulk passage (a different passage ID per language), a passage typed in
  the app (one shared passage ID), a Common MAT question, an English-only question, and two look-alike pairs from the
  same upload.
* Download: each record appears exactly once; pairs and whole passages are correct; the look-alike pairs are not
  guessed; `0.50` is kept.
* Re-upload after sorting rows and making edits: each change is saved to the right record(s). A typed Assamese version
  is added and linked. A manual pairing is saved. Untouched rows are not updated. A row without an ID is not added.
  A lowercase `b` is not treated as a change.
* Re-uploading an unchanged file → no record changes. A file with errors → saving is blocked. The plain Bulk template
  → rejected, with guidance. No page errors.

## V29.1 — Bulk Upload now links English + Assamese of the same row
Before, a normal (non-passage) Excel row with English and Assamese text was saved as two questions **without** a shared
`language_pair_id`. Now both versions of a row get the same link ID (passages already had their own linking).
Upload `teacher-app.js` and `main.html` (now loads `teacher-app.js?v=46`). Press Ctrl+Shift+R. No SQL.
