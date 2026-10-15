# V24: Claude finds English/Assamese pairs and translates the missing ones

On **🌐 Check missing translations**, choose a **Subject**. A purple **🤖 Claude** box then offers two steps:

1. **🔍 Find pairs with Claude.** Claude reads the unlinked questions of that subject and suggests which English
   and Assamese questions are the same question. Nothing is linked until you approve it, in the new tab
   **🤖 Claude suggestions**.
2. **✍ Translate the ones without a partner.** For questions Claude found no partner for, Claude writes the
   missing version: the question and its 4 options, or a whole passage with its 5 questions. The new version is
   linked straight away and can be used in question papers at once. It is marked **Auto-translated — to check**
   until you check it, in the new tab **🤖 Auto-translated — to check**.

Changed files: `bilingual-papers.js`, `main.html`, README.
New files: `supabase/functions/pair-questions/index.ts`, `V24_CLAUDE_PAIRING.sql`
(same as `supabase/migrations/20261015000002_v24_claude_pairing.sql`), this note.

## Install (once)
1. **SQL:** run `V24_CLAUDE_PAIRING.sql` in the Supabase SQL Editor, after V23. It changes no existing data.
2. **Edge Function:**
   * Dashboard → Edge Functions → Deploy a new function.
   * Name it exactly **`pair-questions`**.
   * Paste `supabase/functions/pair-questions/index.ts` and press Deploy.
   * CLI alternative: `supabase functions deploy pair-questions`.
   * It uses the same secrets as V20: `ANTHROPIC_API_KEY`, and optionally `TRANSLATE_MODEL`. If V20 works, nothing
     else needs setting.
3. Upload `main.html` and `bilingual-papers.js`, then press Ctrl+Shift+R.

## How to use it, one subject at a time
1. JNVST Question Bank → **🌐 Check missing translations** → choose the **Subject**.
   The Claude box shows four counts:
   * questions not yet checked by Claude;
   * suggestions waiting for your approval;
   * questions with no partner, ready to translate;
   * questions whose text is in a picture.
2. Press **1. 🔍 Find pairs with Claude**. It works in small steps and shows progress; **■ Stop** pauses it, and you
   can continue later.
3. In **🤖 Claude suggestions**, compare each pair side by side.
   * **✓ Approve** links the pair.
   * **✕ Not the same** means Claude will never suggest that pair again, in either direction.
   * **✓ Approve all strong matches** does them in one go.
   * A *Weaker match* means something differs slightly, for example the options are in a different order. Compare
     those carefully.
   * A red note warns when the two versions have different correct answers.
4. Approve or reject the suggestions **before** step 2: questions waiting for approval are not translated.
5. Press **2. ✍ Translate …**. In **🤖 Auto-translated — to check**:
   * each new question is shown next to its source;
   * **✎ Edit** corrects it, and editing the text or options marks it checked;
   * **✓ Mark checked** or **✓ Mark all shown as checked** clears it from the list.

## What Claude does and does not do
* **Matching:**
  * Claude only compares questions of the same Part, with the closest candidates first: same lesson, answer,
    topic, picture.
  * Picture questions with exactly the same picture are paired without asking Claude.
  * Passages are compared as a whole: passage text and all 5 questions.
* **Translating:**
  * The same safeguards as the explanation translations (V20): maths in `$…$` / `\(…\)` / `\frac{}{}` is
    protected and must come back unchanged, every number must stay the same, and your fixed Assamese terms are
    used (কালি, পৰিসীমা, ল.সা.গু. …).
  * A translation that changes a number, loses a formula, or comes back in the wrong script is refused. The
    question is marked *failed*; **↻ Retry failed** tries again.
  * The answer, picture, subject, lesson, topic, variation group, level and marks are copied from the source.
  * New Assamese questions copy the English explanation, and V20 then translates it automatically.
* **Not possible:**
  * When the question text is inside a picture, Claude cannot read it. These are listed under **➕ Missing** with
    📷 *The text is inside the picture* — type the other version yourself.
  * Passages that are only partly linked are left for you to link by hand.
* **Cost:** every step is a request to your Claude API key, billed per use. Finding pairs sends 4 questions per
  request; translating sends 5 questions, or 1 passage, per request.

## Also
* Rule-based **🔗 Suggested pairs** (V23) still work without Claude. They hide pairs Claude is already handling,
  and pairs you marked *Not the same*.
* New questions have `source_type = JNVST_AUTO_TRANSLATION` and `translation_status = AUTO`. After checking,
  `translation_status = CHECKED`.

## Tested
In a test browser with simulated data and a stand-in for Claude (not your live database or the real Claude):
* Matching suggested every true pair and nothing else. A rejected pair was never suggested again.
* Approving linked the pairs.
* Translating wrote 8 missing questions, all linked and used by the paper generator.
* A translation that changed a number was refused, and the retry worked.
* A passage was translated as one new passage of 5 questions.
* The server code was also tested on its own with Deno, and the SQL on PostgreSQL 16 (run twice).
