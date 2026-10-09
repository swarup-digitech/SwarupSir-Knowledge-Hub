# V12 – Question Paper Generator fix (JNVST → Mock Test → Generate Question Paper)

Only `main.html` was changed (plus housekeeping below). No database change is needed.

## Problems found in the generated PDF (Set A–D)
| # | Symptom | Cause | Fix |
|---|---------|-------|-----|
| 1 | Page 1 had only the header; questions began on page 2 | Arithmetic used one CSS-grid row; a grid row cannot split across pages, so the whole block jumped. Columns were also split by count (1–15 / 16–30) | Arithmetic now uses a real 2-column flow (`.qp-arithmetic-flow`, `column-count:2`). Questions fill left → right → next page, never split |
| 2 | Q11 / Q23 image and text overlapped the other column | Assamese text stored **without spaces** = one huge word; `.jnvst-qbody` had no `min-width:0` so it stretched past the column | `min-width:0` + `overflow-wrap:anywhere` on question body, text and options |
| 3 | Raw LaTeX printed (`\(33\text{ m}^2\)`) | Maths engine failed/was not waited for; wrong backslash count in the "All Questions" viewer; Assamese words inside `\( … \)`; unpaired `\(` | New shared print window with: 3 CDN fallbacks, wait + timeout, **automatic plain-text fallback** (33 m², 2 3/4, 3√(2) cm), Assamese pulled out of math mode, unpaired delimiters/stray `\` cleaned, MathJax error boxes replaced by readable text |
| 4 | PDF came out Letter-size | Printer default | Pop-up now shows a banner: *A4, Margins None, Scale 100%, Print backgrounds*; `@page{size:A4}` |
| 5 | Images could be missing in print | `loading="lazy"` | Images loaded eagerly; print starts only after all images + maths are ready; broken images are reported in the banner |

## Other smooth-working changes
* One shared print window (`qpPrintDocHtml / qpWritePrintWindow`) replaces three copy-pasted ones (new paper, saved set, all-sets view).
* The pop-up is opened immediately after you choose the number of sets (before slow database saves) so Firefox no longer blocks it.
* The browser `prompt()` for number of sets is now a proper dialog (1–4).
* If saving to *Generated History* fails (e.g. SQL not run) the paper **still opens**; the message tells which SQL to run (`jnvst_generated_question_paper_history.sql`).
* Word export: formulas converted to readable text, option text cleaned, images keep their aspect ratio.
* Long options (e.g. `l = 19.2 cm, b = 12.5 cm`) automatically use one column so they never wrap awkwardly.

## Housekeeping
Moved to `_archive_unused/` (not referenced anywhere): `main-inline.js` (stale copy), `main.html.modified`, `teacher-dashboard.before_math_fix.html`, `_teacher_inline.js`, `qb_section.txt`, and `JNVST_MOCK_METADATA_BILINGUAL_PASSAGE_UPGRADE.sql` (byte-identical to `JNVST_MOCK_QUESTION_BANK_METADATA_MIGRATION.sql`).

## Please fix in the Question Bank data (cannot be fixed by code alone)
* Questions whose Assamese text has **no spaces** (the Q11/Q27-type items, e.g. `…আয়তাকাৰচিত্ৰটোৰআৰু…`) – re-enter with spaces. Layout no longer breaks, but the words stay joined.
* Broken math such as `\(a \10 cm × 18 cm\), (b \14 cm …` – re-enter as `a) 10 cm × 18 cm` etc.
* Use **Paper Quality Control** before printing.

## How to print (Firefox)
1. Click **Generate / Print PDF**, choose number of sets.
2. In the pop-up wait for "Ready…", then in the print dialog: Destination → Save as PDF (or your printer), **Paper size A4, Margins None, Scale 100%, tick Print backgrounds**.

## Testing done
Real project functions run in headless Chromium with a 30-question Arithmetic sample built from your Set A (including the problem items Q11, Q20, Q27, images and fractions): 2 A4 pages, questions start on page 1, no overlap, 0 raw LaTeX tokens; also tested with the maths engine blocked (plain-text fallback, 0 raw LaTeX). **Firefox itself was not available in my environment, so please test one print in Firefox.**
