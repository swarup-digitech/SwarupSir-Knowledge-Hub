# JNVST Mock Test V4 — Continuous Bulk Upload / Automatic IDs

This package implements the requested continuous question-bank workflow.

## Teacher does NOT maintain permanent IDs

The teacher chooses only:
- Section/Part
- Language (Assamese or English for EVS, Arithmetic, Language; MAT is COMMON)
- File(s)

The system generates permanent Set IDs and Passage IDs based on the existing bank.

## Complete-set validation

The upload is rejected before insertion when the required structure is incomplete:
- MAT: 4 questions per set
- EVS MCQ: 15 questions per set
- EVS Passage: exactly 5 questions per passage
- Arithmetic: 20 questions per set
- Language Passage: exactly 5 questions per passage

No partial set is inserted.

## Continuous numbering

Examples:
- Pattern: PAT-001, PAT-002, ...; next upload continues after the highest existing PAT number.
- English Language: L-E-001, L-E-002, ...
- Assamese Language: L-A-001, L-A-002, ...
- English EVS passages: EVS-E-P-001, ...
- Assamese EVS passages: EVS-A-P-001, ...
- Arithmetic: AR-E-001 / AR-A-001

## Passage upload

Excel may contain `Local Passage No. (optional)`. This is only a local grouping key for that upload. If omitted, the system groups rows sequentially in blocks of five.

The system converts each local group into a permanent Passage ID and assigns the same permanent ID to all five questions.

## Duplicate protection

If an active duplicate is detected in an upload, the entire upload is rejected rather than silently skipping the duplicate. This prevents an incomplete set from being created.

## Language selection

MAT questions are stored as COMMON.
EVS, Arithmetic and Language are stored as ASSAMESE or ENGLISH.
The Mock Test generator selects MAT COMMON plus the chosen language bank.
