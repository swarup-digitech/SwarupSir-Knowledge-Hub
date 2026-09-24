# Fixed Questions + Multi-Select Chapter Filter + Chapter Marks Range

## 1. Run SQL once
Run `school_question_paper_generator_upgrade.sql` in Supabase SQL Editor.

This adds `is_fixed` to `school_question_bank_questions`.

## 2. Fixed Questions
A question can be marked Fixed during Excel/Word/PDF-metadata bulk upload or later in Question Bank.

Accepted bulk values: `Yes`, `No`, `Y`, `N`, `TRUE`, `FALSE`, `1`, `0`, `Fixed`.

The Question Bank table provides Fixed Only / Non-Fixed Only filters and a Mark Fixed / Unfix action. The editor also has `Fixed Question — Must Be Included`.

The paper generator displays only persisted Fixed questions under `Fixed Questions — Must Be Included`; the teacher does not select arbitrary questions there.

## 3. Optional Chapter Filter
The generator now supports selecting multiple chapters. If none are selected, all chapters are eligible. Subchapters are included when their parent chapter is selected.

## 4. Chapter-wise Marks Range bulk upload
Use `Chapter_Wise_Marks_Range_Bulk_Upload_Template.xlsx`.

Columns:
- Chapter No
- Chapter Name (optional)
- Minimum Marks
- Maximum Marks

Upload is available in the Question Paper Generator. Values are validated and applied to the chapter-range table. Minimum cannot exceed maximum.

## 5. Constraint behavior
Fixed questions count toward total marks, chapter minimum/maximum marks, cognitive distribution, and variation-group constraints. Two Fixed questions in the same Variation Group are rejected. A Fixed question outside the selected chapter filter is rejected.
