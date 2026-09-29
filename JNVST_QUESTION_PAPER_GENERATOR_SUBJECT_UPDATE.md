# JNVST Question Paper Generator — Subject-wise Mandatory + Random Selection

Updated `main.html` in the working project.

## Supported subjects
- Mental Ability (MAT): existing five-part structure retained. Teacher can mark mandatory questions in each MAT part; remaining slots are filled randomly.
- Arithmetic: 20 questions or a multiple of 20. Mandatory questions are preserved and the remaining questions are selected randomly.
- EVS: 1 or more EVS sets. Each set = 15 EVS MCQs + 1 complete passage group containing 5 questions. Teacher can mark mandatory MCQs and mandatory passage sets; remaining MCQs/passages are random.
- Language: teacher chooses the number of complete passage sets. Each set contains exactly 5 linked questions. Selecting any question makes its complete passage set mandatory; remaining passage sets are random.

## Validation
- MAT: 4, 8, 12... questions per part; total 20, 40, 60...
- Arithmetic: 20, 40, 60...
- EVS: 15 MCQs + 1 passage set per selected EVS set.
- Language: complete five-question passage sets only.
- The generator prevents mandatory selections from exceeding the requested number.
- The generator prevents incomplete passage groups from being selected.

## Output
The generated PDF/Word/Answer Key use the same generated rows. Answer Key includes a Selection column showing `MANDATORY` or `RANDOM`.
