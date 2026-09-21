# Mock Test Passage Upload Fix

This update fixes EVS and Language passage bulk-upload validation.

## Required Excel structure

### Questions sheet
For `EVS_PASSAGE` and `LANGUAGE_PASSAGE`:

- `Local Passage No.` is required on every passage-question row.
- The same local passage number must occur on exactly 5 question rows.
- `Question Order` must be exactly 1, 2, 3, 4, 5.

### Passages sheet

Each referenced local passage number must have exactly one row containing:

- `Local Passage No.`
- `Passage Title`
- complete `Passage`

The complete passage title/text is copied to all 5 question-bank rows and later snapshotted into generated Mock Tests.

## Important

The uploader accepts both the documented `Local Passage No.` heading and legacy passage-number aliases. Numeric values such as `1` and `1.0` are normalized to the same local passage key.
