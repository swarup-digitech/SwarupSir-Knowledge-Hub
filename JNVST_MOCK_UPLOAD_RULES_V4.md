# JNVST Mock Test Bulk Upload — Automatic Set/Passage IDs

Teachers **do not enter permanent Set ID or Passage ID**.

The uploader generates them automatically from the existing question bank, so questions can be uploaded continuously over time.

## Required complete upload sizes

| Bank | Required upload | Examples |
|---|---:|---|
| MAT Pattern Completion | multiple of 4 | 4, 8, 12, 16... |
| MAT Figure Series Completion | multiple of 4 | 4, 8, 12... |
| MAT Geometrical Figure Completion | multiple of 4 | 4, 8, 12... |
| MAT Mirror & Water Imaging | multiple of 4 | 4, 8, 12... |
| MAT Embedded Figure | multiple of 4 | 4, 8, 12... |
| EVS MCQ | multiple of 15 | 15, 30, 45... |
| EVS Passage | complete groups of 5 | 5, 10, 15... |
| Arithmetic | multiple of 20 | 20, 40, 60... |
| Language Passage | complete groups of 5 | 5, 10, 15... |

## Passage uploads

For passage banks, the Excel file may use a **Local Passage No.**. This is only an upload-time grouping marker.

Example:

```text
Local Passage No. 1 → Q1-Q5
Local Passage No. 2 → Q1-Q5
Local Passage No. 3 → Q1-Q5
```

The system converts these into permanent IDs such as:

```text
L-A-001
L-A-002
L-A-003
```

or:

```text
L-E-001
L-E-002
L-E-003
```

for Language, and equivalent `EVS-A-Pxxx` / `EVS-E-Pxxx` IDs for EVS.

If Local Passage No. is omitted, rows are grouped sequentially in blocks of 5.

## Normal MCQ uploads

For EVS MCQ and Arithmetic, no Set ID is required. The uploader groups the questions sequentially into complete sets.

Example: 45 EVS questions become:

```text
EVS-A-001 → Q1-Q15
EVS-A-002 → Q16-Q30
EVS-A-003 → Q31-Q45
```

## MAT PDF uploads

MAT remains `COMMON`, because the same image questions are used in Assamese and English tests.

Example: 20 Pattern PDF pages become:

```text
PAT-001 → pages 1-4
PAT-002 → pages 5-8
...
PAT-005 → pages 17-20
```

## Continuous uploads

If `PAT-005` is the last existing Pattern set, the next upload starts at `PAT-006` automatically.

If `L-E-025` is the last English Language passage, the next English upload starts at `L-E-026`.

## Duplicate protection

If any question in a new upload duplicates an active question already in the bank, the **entire upload is rejected**. This prevents a duplicate from causing an incomplete set.

## Language rules

- MAT → `COMMON`
- EVS → `ASSAMESE` or `ENGLISH`
- Arithmetic → `ASSAMESE` or `ENGLISH`
- Language → `ASSAMESE` or `ENGLISH`

The Mock Test generator filters automatically by the selected test language.
