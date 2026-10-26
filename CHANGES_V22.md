# V22: No more "Variation Group uniqueness" errors in Custom Adaptive Papers

Before V22, many personal papers were stopped at **🖨️ Save to history & print** with
*"Variation Group uniqueness: Repeated group(s): 4, 15 | 5, 14"*. V22 fixes the cause, so the papers are
built correctly from the start.

Changed files: `custom-adaptive.js`, `custom-adaptive-paper.js`, `teacher-app.js` (one message), `main.html` (version numbers), README.
No SQL to run. Upload the files and press Ctrl+Shift+R.

## Why it happened
The 60% "from mistakes" part never looked at Variation Groups. A student who had got several questions
of one group wrong (for example 3 simplification questions in SIM-001) got all of them, or a variation of
each of them, in the same paper. When the bank ran short, a "last resort" step also allowed a second
question of a group. Swap, Choose and Add were already correct.

## What V22 does
* **One question per Variation Group in the whole paper**, mistakes included. The worst mistake of a group
  (most wrong, then most recent) is asked. The other mistakes of that group stay active and come back in a
  later paper. The free places are filled with new questions, as before.
* **The rule covers the whole paper**: all MAT parts together, and EVS MCQs together with EVS passages.
* **Passages (EVS / Language):** two passages of the same Variation Group are not put in one paper
  if another passage is available. If every passage is needed, the similar one is still used, so no passage is missing.
* **No repeat as a last resort.** If the bank really has too few different groups, the paper is shown as
  *"N short"* instead of repeating a group.
* **The bank is counted in groups.** "Available in your bank" now shows, for example, *Arithmetic: 140 questions in 65 groups*.
  ⚙ Generate stops with a clear message if a part needs more questions than there are different groups.
* **🔧 Fix button:** if the print check still finds a repeated group (for example in papers generated before
  this update), the warning box has a button *Fix repeated Variation Groups automatically*. It replaces only
  the repeated question with the best question from a group not yet in that paper, and marks that paper
  *not verified* so you can check it.
* **Clearer message:** the check now names the group: *Repeated group(s): Q4 & Q15 (SIM-001)*.

## Not changed
* **Custom Adaptive Assignments (V15)** work exactly as before (tested: same result as the old file in 200 cases).
* The normal Question Paper Generator works as before; only its message names the group now.

## Tested
* 1,000 simulated Arithmetic papers (60% from mistakes, mistakes concentrated in 3 chapters):
  old files **943 papers (94%)** with a repeated group, V22 **0**. Mistake questions per paper stay at 12 of 20.
* 17 unit checks: one mistake per group, worst mistake kept, short instead of repeat, assignments unchanged,
  EVS similar passages, Swap/Choose lists, repair button logic, groups unique across MAT parts.
* Browser run of the screen with a test bank: generate, print check with the fix button, fix, no repeats left, no page errors.
**Not tested on your live Supabase project.**

## Tip
Most of the remaining "short" or "fewer mistakes" cases come from lessons with few groups. Arithmetic
*Simplification* has 12 questions but only 3 groups (8 questions are in SIM-001). Adding questions in **new**
groups there gives the papers more variety.
