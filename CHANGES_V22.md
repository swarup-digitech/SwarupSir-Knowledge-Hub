# V22: Faster Teacher Admin Panel

The JNVST teacher dashboard, Assignment Results, the Excel exports and the JNVST Question Bank
now open faster and no longer lose data once there are many assignments.
Nothing changes in how anything works for students.

Changed files: `main.html`, `teacher-app.js`, README, `supabase/README.md`.
New files: `V22_SPEED_INDEXES.sql` (same as `supabase/migrations/20261014000001_v22_speed_indexes.sql`), this note.

## Install (once)

1. **SQL:** run `V22_SPEED_INDEXES.sql` in the Supabase SQL Editor. It only adds indexes and makes one
   access rule cheaper to check. It changes no data and is safe to run again.
   The messages list each index as *ready* or *skipped*.
2. Upload `main.html` and `teacher-app.js` to the website and press Ctrl+Shift+R.

## What changed

### Teacher tools download at the same time
`main.html` used to download the 7 teacher files one after another (teacher-app.js, then custom-adaptive.js,
then …). They now download together and still run in the same order. If one of the optional add-ons
fails, the rest still work, as before.

### JNVST dashboard: no saving on every open, one round of requests
* The two fixed classes (JNVST-VI, JNVST-IX) were re-saved every time the dashboard opened. They are now
  saved only when something is actually wrong with them. The one-time repairs (merging duplicate fixed
  classes, moving old Navodaya groups) still run automatically, but only when needed.
* Classes, assignments, JNVST students, subjects, lessons and class memberships are requested together.
  Only JNVST students are requested. School students used to be downloaded and then thrown away.
* **Data fix:** Supabase sends at most 1000 rows per request. With personalised (adaptive) assignments
  (one row per student), assignments over 1000 used to be silently missing from the dashboard and its
  counts. All rows are now loaded page by page.

### Adding or editing a group, subject or lesson
Saving used to reload the whole dashboard and then jump to *Manage Groups & Subjects* after a pause.
It now reloads only the groups, or only the subjects and lessons, and shows the page straight away.

### Assignment Results and Excel downloads
* **Bug fix:** with many assignments, *Assignment Results*, *Download All Results* and
  *Download Filtered Excel* sent every assignment id in a single request. That request became too long
  and failed, or rows after 1000 were cut off. Long lists are now sent in small parts at the same time.
* The Personalised tab's submitted / average badges load all parts at the same time instead of one by one.
* School *Manage Assignments* also loads all assignments and question counts this way.

### JNVST Question Bank
* Shows **50 items at a time** (a 5-question passage group counts as one item), with *Show 50 more* and
  *Show all* buttons. When you come back after editing, the same number is shown again, so you return to
  the question you were on.
* Search waits until you stop typing (0.3 s) instead of redrawing the whole bank on every key.
* Ticking a group, marking Common and other small changes redraw only the shown items, so they are quick.
* The tick box at the top of the table still selects **all** matching questions, including those not shown
  yet. Hover over it to see the number. The button *Delete All Visible* is renamed
  **Delete All Matching Filters** to make clear that it includes questions on later pages.

### Database (V22_SPEED_INDEXES.sql)
Indexes for: questions of an assignment, answers of an attempt, attempts by assignment and by student,
students of a class, assignments of a teacher and of a class, profiles by role/course, classes by
teacher, JNVST subjects/lessons and the question bank by teacher. The rule
*Teachers can view students in their classes* uses `(select auth.uid())`. Who can see what is the same.

## Measured in a test browser
These numbers come from a test copy with simulated data: 300 JNVST and 150 School students,
1,500 assignments, 750 submissions and 700 bank questions. Each request took 0.12 s and each file
0.25 s, to mimic mobile data.

| | Before | After |
|---|---|---|
| Open JNVST dashboard | 2.9 s, 2 saves | 1.2 s, 0 saves |
| Assignments counted on dashboard | 1000 of 1500 | 1500 of 1500 |
| Assignment Results | failed (request too long) | 750 submissions shown |
| Add a subject → back on Manage page | 21 requests | 3 requests |
| Question Bank first draw | 700 rows | 50 rows (+ Show more) |
| Typing "apple" in Search | 5 full redraws | 1 redraw |

Real speed depends on your data and internet. The test did not include your live Supabase database.

## Note
Paged loading assumes Supabase's default limit of 1000 rows per request
(Dashboard → Settings → API → Max rows). Leave that setting at 1000 or higher.
