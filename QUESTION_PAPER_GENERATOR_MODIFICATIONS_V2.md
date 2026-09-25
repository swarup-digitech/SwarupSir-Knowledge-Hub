# Question Paper Generator — Modifications V2

## Implemented in `teacher-dashboard.html`

### 1. Chapter-wise Marks Range — Excel Bulk Upload
- Added **Bulk Upload Excel** inside the Chapter-wise Marks Range section.
- Added **Excel Template** download button.
- Accepted columns:
  - Chapter No
  - Chapter Name (optional for matching)
  - Minimum Marks
  - Maximum Marks
- Validates missing chapters, numeric marks, negative values, duplicate chapters, and Minimum > Maximum.
- Main chapter ranges are used for generation; subchapter marks continue to count under their main chapter.
- The imported values fill the generator controls and are used only for the current paper generation session.

### 2. Optional Chapter Filter — Multi-select
- Replaced the single chapter dropdown with a multi-select checkbox tree.
- Teacher can select multiple main chapters and/or individual subchapters.
- Selecting a main chapter includes all of its subchapters.
- Selecting only a subchapter limits questions to that subchapter.
- Selecting nothing keeps all chapters eligible.
- Added **Select All Chapters** and **Clear Filter** buttons.
- The generator's candidate question pool is restricted to the selected chapter scope while still applying total marks, cognitive-level, question-type, variation-group, fixed-question, and chapter-range constraints.
- Chapter-wise marks-range rows are automatically limited to the selected chapter scope.

## Database
No new database migration is required for these two changes because chapter-wise marks ranges are generation-session settings, not persistent database records.
