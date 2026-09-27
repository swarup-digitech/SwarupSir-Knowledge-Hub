# Performance Improvements Made

No business logic, features, or database schema were changed. Everything below is safe,
behavior-preserving, and focused on making pages load and feel faster — especially on
slower mobile connections.

## 1. Compressed images (~65-70% smaller, same visual quality)
| File | Before | After |
|---|---|---|
| swarup-sir-logo.png | 472 KB | 160 KB |
| skh-icon-512.png / skh-icon.png | 344 KB | 100 KB |
| skh-icon-192.png | 64 KB | 20 KB |

These logos/icons load on almost every page (login screens, dashboards, PWA install),
so this alone cuts a large chunk of data off every first visit.

## 2. Stopped blocking page render on heavy JS libraries
`main.html`, `teacher-dashboard.html`, and `school-dashboard.html` were loading
Excel (xlsx, ~900KB), PDF (jsPDF/autotable), Word (mammoth), and math-rendering
(MathJax) libraries synchronously in `<head>` — meaning the browser had to fully
download and execute ~1–1.5MB of JS before it could even start painting the page,
on *every* visit, even though these libraries are only used when a teacher clicks
an export/import/print button.

Added the `defer` attribute to those script tags. This lets the browser parse and
show the page immediately while those libraries download in the background — they're
still fully loaded and ready by the time anyone actually uses the related feature.
(Verified every usage of XLSX/jsPDF/mammoth/MathJax in the code is inside a function
triggered by a later user action, never at page-load time, so this is safe.)

`@supabase/supabase-js` was left as-is (blocking) since the app calls
`supabase.createClient(...)` immediately when the page loads.

## 3. Added `preconnect` hints
Added `<link rel="preconnect">` for the Supabase project domain and `cdn.jsdelivr.net`
on the main app/login/dashboard pages, so the browser opens those network connections
in parallel with parsing the page instead of waiting until the script/API call is reached.

## 4. Fixed a broken, unused service worker
`sw.js` and `manifest.webmanifest` referenced icon files (`/icon-192.png`, `/icon-512.png`)
that don't exist in the project (the actual files are `skh-icon-192.png` / `skh-icon-512.png`).
Neither file was actually linked from any page — the app uses `student-sw.js` and
`student-app.webmanifest`, which are correct. Removed the two dead, broken files
to avoid confusion for anyone maintaining the project later.

## Net effect
Total package size: 2.3 MB → 1.4 MB. First-load JS blocking the page shrank by
roughly 1–1.5MB on the app's busiest pages (main.html, teacher-dashboard.html),
and every page now shows content sooner instead of waiting on export/import
libraries most visits never use.

## Not changed (out of scope / needs live testing)
The project has 40+ SQL migration files and a large amount of Supabase query logic.
Reviewing database indexes/query performance would need access to the live Supabase
project (schema, actual data volume, query plans) to do safely — happy to help with
that if you can share read access or `EXPLAIN ANALYZE` output for slow queries.
