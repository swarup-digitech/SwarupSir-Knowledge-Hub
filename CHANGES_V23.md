# V23: English + Assamese question papers, missing-translation check

1. **JNVST Question Bank → 🌐 Check missing translations** lists every English question without its Assamese
   version (and the other way round), suggests pairs that belong together, links them, and lets you type in a
   missing version.
2. **Question Paper Generator (MAT, Arithmetic, EVS)** always makes **two PDFs**: English medium and Assamese
   medium, with the same questions, numbering, order and answer key. **Language papers are unchanged**, with one
   paper per language as before.

Changed files: `main.html`, `teacher-app.js`, README.
New files: `bilingual-papers.js`, `V23_BILINGUAL_PAIRS.sql` (same as
`supabase/migrations/20261015000001_v23_bilingual_pairs.sql`), this note.

## Install (once)
1. **SQL:** run `V23_BILINGUAL_PAIRS.sql` in the Supabase SQL Editor. It adds one function that links many
   pairs in a single request, and changes no data. Without it, linking still works, only slower.
2. Upload `main.html`, `teacher-app.js` and `bilingual-papers.js` and press Ctrl+Shift+R.
3. Open **JNVST Question Bank → 🌐 Check missing translations** and link your existing questions (see below).
   Until a pair is linked, the generator treats that question as having no other-language version.

## Why the first check shows many unlinked questions
English and Assamese versions are linked by a shared pair ID.
* Questions added by hand (➕ Add JNVST Question) and variation questions were already linked.
* **Excel bulk uploads never linked them.** From now on, the English and Assamese versions in the same Excel
  row are linked automatically.

For questions already in the bank, the check suggests pairs:
* **Sure:** uploaded in the same upload, with the same subject, lesson, part, topic, variation group, answer,
  picture, marks and level. Press **🔗 Link all sure pairs**.
* **Likely:** the same details, but uploaded at different times. Look through them, then link them all or
  one by one.
* Passages are matched as whole passages (5 questions, same answers in order) and linked question by question.

## The 🌐 Check missing translations page
* **Not checked:** Common (MAT) questions, which serve both languages, and Language-subject questions, which
  have their own paper per language. Switched-off questions are also left out.
* **🔗 Suggested pairs:** the Sure and Likely pairs, side by side.
* **➕ Missing:** the questions with no partner, by Subject → Lesson. For each one you can:
  * **➕ Add Assamese/English version:** type the question and options. The answer, subject, lesson, topic,
    variation group, level and (optionally) the picture are copied, and the two are linked.
  * Use **➕ Add … passage** for a whole passage with its 5 questions.
  * **🔗 Link to an existing … question:** choose from unlinked questions of the same subject, closest
    first.
* **⚠ Linked but different:** linked pairs that disagree. Checked: different correct answer, Part, Subject or
  Lesson; a picture in only one version; one version switched off. Use **✎ Edit** to fix the question, or
  **✂ Unlink** if the two are not the same question.

## Question Paper Generator
* The **Language** dropdown is now **Show questions in**. It only changes the language shown while you tick
  mandatory questions. Ticked questions switch to their partner when you change it.
  For **Language** papers it is still the paper's language.
* A note under the subject summary says how many questions have no other-language version. In the lists they
  are marked **⚠ No English/Assamese version — used only if you tick it**.
* **Random questions** come only from questions that have both versions. For EVS passages, all 5 questions
  must be linked.
* **Before the papers are made**, you get a warning in two cases:
  * a ticked question has no partner (it is then printed in the shown language in both PDFs);
  * a partner has a different answer (the shown language's answer is used in both).
* After **Generate**, the shown-language PDF opens as before. A green box then offers both papers:
  **🖨 English-medium PDF** and **🖨 Assamese-medium PDF**. Each window's title is the PDF file name, for
  example *JNVST Practice Question Paper — English medium — SET A, SET B*.
* Each paper says **ENGLISH MEDIUM** or **ASSAMESE MEDIUM** under the title.
* With several sets (A–D), each PDF contains all sets. SET A English and SET A Assamese have the same
  questions in the same order.
* **MAT:** Common questions appear in both papers. If you also have English/Assamese MAT questions, only
  linked ones are used, once each.

## Generated History
* One entry per set holds both languages. The buttons are **Paper (English)**, **Paper (Assamese)**,
  **📄 All Questions (English)** and **📄 All Questions (Assamese)**.
* The answer key is the same for both languages, so one OMR import covers English- and Assamese-medium
  students.
* The answer key Excel gains a *Question ID English/Assamese* column.

## Not changed / good to know
* **Mistake Bank after OMR import:** answers are recorded against the question IDs of the language that was
  shown when the paper was made. For Assamese-medium students on a paper made with English shown, mistakes are
  saved on the English question. The app has no field that says which medium a student is in, so this can't
  be split yet.
* **⬇ Word download** of the generated paper is still made in the shown language only.
* The fixed paper texts (*Instructions*, *Name*, *Roll No.*, *Passage 1*) stay in English in both papers.

## Tested in a test browser
Tested with simulated data, not your live database:
* Linking: 15 suggested pairs, linked with one request (and again without the SQL function, one by one).
* Adding a missing question and a missing passage: saved and linked.
* Arithmetic, 2 sets: Assamese and English PDFs with identical order and answer keys. Random questions only
  from linked pairs; a ticked unlinked question triggered the warning.
* EVS: 15 MCQs + 1 passage, identical order in both papers.
* MAT: Common questions, medium label shown.
* Language papers: still one paper in the chosen language.
* Excel import: both versions of each row linked, for MCQs and passages.
* The earlier V22 checks still pass.
