# V21: Class discussion PDF after an OMR import

After OMR results are imported, you can download a PDF to discuss the paper in class with a projector and pen tablet.

Changed files: `main.html`, `teacher-app.js`, `custom-omr.js`, README. New file: `omr-discussion.js`.
No SQL to run. Upload the files and press Ctrl+Shift+R.
(If V20 is not installed yet, install V20 as well. See `CHANGES_V20.md`.)

## Where to find it
* **Import OMR Results** → *Previous OMR Imports* → new column **Class discussion** → **📽 PDF**
* **Personal OMR Sheets** → open a batch → *3. Result reports* → **📽 Class discussion PDF (one question per page)**

## What each page shows
* Wide page (A4 landscape or 16:9 widescreen), **one question per page** in large letters (picture, question, options).
* At the top: the question's number in **every set** (`Set A · Q5`, `Set B · Q12` …). For personal papers it shows how many papers had it.
* Next to each option: **how many students chose it**. The correct option is marked ✓ (optional).
* On the right: ✗ wrong, — skipped and ✓ correct counts, and the **students who were wrong** (with the option they chose and their
  set/question number) and **who skipped it**. Long lists get smaller, and only first names are shown, so the list fits the page.
* Passage questions: the passage gets its own page before its first question.
* Optional: the explanation (Assamese for Assamese medium, from V20), and empty space at the bottom for writing with the pen.
* First page: a summary table of all included questions with wrong / skipped / correct counts.

## Options (asked before the PDF is made)
* Page shape: A4 landscape, or 16:9 widescreen for projectors and smart boards
* Questions: only those someone got wrong or skipped (default), or all
* Order: paper order (Set A numbering), or most mistakes first
* Mark correct answer · show option counts · show student names · show explanation · leave writing space

## Saving the PDF
The pages open in a new tab. When the maths has finished loading, press **🖨 Save as PDF / Print** and choose **Save as PDF**.
The page size is already set. Keep scale at 100%.
