# V40 – bilingual pen-paper sets, new first page, Assamese MAT directions
Upload main.html + teacher-app.js (cache-bust v=58). Run V40_MOCK_BILINGUAL_SETS.sql in Supabase (it contains the whole V37 migration; safe to re-run).

1. First page (paper PDF): institute name on top, "JAWAHAR NAVODAYA VIDYALAYA SELECTION TEST <year> FOR VI", boxed "Mock Test", rule, details table. Year = year of the test date +1 when made in June–December. Footer shows "· English/Assamese Medium".
2. Pen-paper tests are always made in BOTH languages: N sets x (English + Assamese) = 2N booklets, one exam code. Same question order in both languages; the other language uses the paired question (language_pair_id from bilingual upload; passages/unpaired questions are matched by lesson/topic/group/answer pattern; anything not unique is asked in a "Match the questions" box). Online tests stay in the chosen language only.
3. MAT directions in the booklet language (Assamese wording approved by you; "সলনি নকৰাকৈ"; তোমাৰ; English digits). Applies to PDF and the online test screen. EVS/Arithmetic/Language directions are still English.
4. Test list: one entry per exam; PDF button for every set and language.
5. OMR import: new Language column (default = chosen language; change for all or per student); the RPC picks the booklet by Set + Language, so Mistake Bank links to the right language question.
