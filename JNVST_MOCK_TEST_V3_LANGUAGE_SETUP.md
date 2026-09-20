# JNVST Mock Test V3 — Assamese / English

## Language architecture
- MAT is shared: `language = COMMON`.
- EVS, Arithmetic and Language use `ASSAMESE` or `ENGLISH`.
- Language is one generic passage bank: `LANGUAGE_PASSAGE`.
- Each Language passage must contain exactly 5 questions.
- Each EVS passage must contain exactly 5 questions.
- Arithmetic supports Excel or PDF + answer key.

## Teacher workflow
1. Run `jnvst_mock_test_v3_language_migration.sql` in Supabase after the existing Mock Test migrations.
2. Bulk upload EVS/Arithmetic/Language with the language selector set to Assamese or English.
3. Upload MAT with Common (MAT) selected.
4. Open Generate Mock Test.
5. Select Assamese or English. The available sets are filtered to that language; MAT remains common.
6. Select one complete set/group for every required part and assign the generated test to students/classes.

## Test composition
Assamese: MAT COMMON + EVS ASSAMESE + Arithmetic ASSAMESE + Language ASSAMESE.
English: MAT COMMON + EVS ENGLISH + Arithmetic ENGLISH + Language ENGLISH.

## Existing V2 Language data
The migration preserves old generic Language questions as Assamese. Upload the English equivalents separately.
