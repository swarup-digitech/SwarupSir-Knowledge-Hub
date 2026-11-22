# V45 – answer keys
Upload main.html + teacher-app.js (cache-bust v=63). No SQL (V40 SQL must already be run).
1. Mock Test list, every pen-paper exam: "🔑 Answer Key (PDF)" and "⬇ Key (Excel)".
   PDF: per set, 80 answers in four blocks (Q1-20 MAT, 21-40 EVS, 41-60 Arithmetic, 61-80 Language), English and Assamese side by side; questions where the two keys differ are red, with a count at the top.
   Excel: Q.No, Section, then one column per Set x Language (Set A English, Set A Assamese, ...).
2. OMR import: the answer key is per booklet language. The language of each student is taken from the sheet's key column when English and Assamese keys differ (shown "language from key"); otherwise the default / your choice. Check table now shows "match saved key" per Set + Language. Scoring in the database already uses the key of the student's own booklet (set + language).
