# Chapter-wise Marks Range — Bulk Upload

The School Course Teacher Dashboard now supports bulk uploading the chapter-wise minimum and maximum marks used by **Generate Question Paper**.

## Where to use it

Teacher Dashboard → **Question Bank** → **Generate Paper** → **Chapter-wise Marks Range**.

Click **Bulk Upload Chapter-wise Marks Range**.

## Excel columns

| Column | Required | Description |
|---|---|---|
| Chapter No | Yes | Must match the main/root chapter number in the Question Bank, e.g. `1`, `2`, `3` |
| Chapter Name | No | Used as a fallback match and recommended for clarity |
| Minimum Marks | Yes | Minimum marks that must be selected from that chapter |
| Maximum Marks | Yes | Maximum marks allowed from that chapter; leave blank for no upper limit |

Questions belonging to subchapters are counted under their parent/main chapter.

## Behaviour

- The upload fills the existing Chapter-wise Marks Range table; it does **not** upload or modify questions.
- Duplicate chapter rows in the Excel file are reported as errors.
- Unknown chapter numbers/names are reported as errors.
- Minimum marks cannot exceed maximum marks.
- Values must be non-negative whole numbers.
- The existing generator then applies these ranges together with total marks, fixed questions, variation groups and cognitive-level distribution.

No additional database migration is required for this feature because the ranges are applied to the current paper-generation blueprint rather than permanently stored.
