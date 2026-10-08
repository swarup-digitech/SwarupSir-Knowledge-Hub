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


## 2026-10-08 — Arithmetic 40/60/... first-page blank fix

- Root cause: Arithmetic generation placed the entire question list inside one large CSS grid. When the list was taller than one A4 page, Chromium could move the complete grid to the next page, leaving the first page with only the header/instructions.
- Fix: Arithmetic question rendering is now split into 20-question page-sized chunks. Each chunk keeps the proven two-column layout used by the 20-question paper. Chunks after the first start on a new page.
- Result: 20 questions remain in the existing layout; 40 questions render Q1–Q20 on page 1 and Q21–Q40 on page 2; the same pattern continues for 60/80/... questions.
- Updated both the active `main.html` implementation and `main-inline.js` source copy.
