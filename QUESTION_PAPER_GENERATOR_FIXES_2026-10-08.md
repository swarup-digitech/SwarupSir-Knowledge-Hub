# Question Paper Generator – Formatting & Stability Fixes

## Fixed
- Removed the fixed Arithmetic 10+10 CSS grid that could become an unbreakable block and leave page 1 with only the header.
- Arithmetic questions now use a continuous two-column print flow while preserving serial order.
- Removed the forced page break before EVS Passage 2; Passage 2 can now begin on the same page when space is available.
- EVS passage questions now use a continuous two-column flow instead of a fixed left/right grid.
- Added stronger JNVST subject matching: when a question has a `subject_id`, the selected JNVST subject is authoritative. This prevents Arithmetic questions with an incorrect `section_code` from appearing in EVS.
- Applied subject filtering consistently to question pools, EVS generation and passage pools.
- Added a visible **Paper Quality Control** button and automatic QC before PDF generation.
- QC checks serial numbering, duplicate IDs, question content/image, valid answer options, subject isolation, MAT distribution and EVS passage/MCQ counts.
- Preserved the existing Generated Question Paper history and answer-key workflow.

## Important
The generated PDF supplied for review showed the header alone on pages 1, 4, 7 and 10, followed by question content on the next page, plus sparse tail pages. The fixed-grid/multi-block print structure was the main cause addressed in this revision.
