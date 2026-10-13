# V20: Assamese explanations for the JNVST / Mock question bank

Assamese-medium students now see the explanation in Assamese. English explanations are translated
automatically, both the ones already in the bank and every new question. You check the translations
and correct any mistakes. A corrected one is never replaced automatically.

Changed files: `teacher-app.js`, `main.html`, `omr-engine.js`, `custom-omr.js`, `student-omr.js`,
`JNVST_Question_Bank_Bulk_Upload_Template.xlsx`, README.
New files: `assamese-explanations.js`, `V20_ASSAMESE_EXPLANATIONS.sql`,
`supabase/functions/translate-explanations/index.ts`.

School Course is unchanged.

## Install (once)

1. **SQL:** run `V20_ASSAMESE_EXPLANATIONS.sql` in the Supabase SQL Editor. The last line shows how many
   existing explanations are queued for translation.
2. **Claude API key:** create a key at console.anthropic.com (API keys). Translation uses the API and is billed
   per use. A short explanation costs a fraction of a rupee.
3. **Secret:** Supabase Dashboard → Edge Functions → Secrets → add `ANTHROPIC_API_KEY` = your key.
   Optional: `TRANSLATE_MODEL` (default `claude-sonnet-5-5`).
4. **Edge Function:** Dashboard → Edge Functions → Deploy a new function → name it exactly
   `translate-explanations` → paste `supabase/functions/translate-explanations/index.ts` → Deploy.
   (CLI: `supabase functions deploy translate-explanations`.)
5. Upload the changed files to the website and press Ctrl+Shift+R.
6. Open **JNVST Question Bank**. Translation of all existing explanations starts by itself. The new
   **🌐 Assamese explanations** box shows the progress.

If steps 2–4 are not done yet, the box says so. Nothing else is affected.

## How it works

* The English text stays in **Explanation**. The Assamese text goes into a new **Explanation — Assamese** field.
  It is used for questions of the **Assamese** medium and **Common (MAT)** questions. English questions are not touched.
* **Automatic for new questions.** Any way of saving (bulk Excel, MAT PDF, manual add, variation pair,
  edit screens, Mock Test uploads) queues the question. The translation runs the next time the Question Bank opens.
  That happens straight after every upload or save.
* **Maths is protected.** Formulas (`$…$`, `\(…\)`, `\frac{}{}`, `\sqrt{}` …) are hidden from the translator and put
  back unchanged. Numbers, units and option letters are kept. Fixed terms are used throughout (কালি, পৰিসীমা,
  দৈৰ্ঘ্য, প্ৰস্থ, বাহু, বৰ্গ, আয়ত, কৰ্ণ, গতিকে …). A translation that loses a formula or changes a number is
  rejected. It is marked **Failed** and never saved wrongly.
* **Status of each Assamese explanation** (badge in the table, column Level / Common):
  * `অ Waiting`: queued for translation
  * `অ Auto — check`: machine-translated, please check
  * `অ Checked`: typed or corrected by you; never replaced automatically
  * `অ Failed`: hover to see why; press **↻ Retry failed** or type it yourself
* If you change the **English** explanation of a question whose Assamese one is still *Auto*, it is translated again.
  If it is *Checked*, your Assamese text is kept.

## Checking and correcting

* Question Bank → **🔎 Show auto-translated (to check)**, or use the new filter **Assamese explanation**.
* **✎ Edit** a question → section **3b. Explanation — Assamese**. Correct the text and save: it becomes *Checked*.
  If it is already right, tick **"The Assamese explanation is correct — mark as checked"**.
  To get a fresh translation, empty the box and save.
* Many correct ones at once: tick them → **✓ Mark selected as checked**.
* Passage blocks: each question in **Edit Complete Block** has its own Assamese explanation box.

## Bulk upload

The JNVST Excel template has a new optional last column, **Explanation Assamese**. Leave it blank and the
English **Explanation** is translated automatically. If you fill it, your text is used and marked *Checked*.
Old files without the column still upload.

## Where students see it

The OMR result report (student PDF and the teacher's printed reports) shows:

* Assamese question: **ব্যাখ্যা:** in Assamese. Until a translation exists, the English one is shown.
* Common (MAT) question: English and Assamese.
* English question: English, as before.

Reports of papers printed **before** V20 also show the new Assamese explanations. The report reads the current
text from the question bank.
