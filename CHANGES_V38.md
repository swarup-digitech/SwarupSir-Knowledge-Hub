# V38 – Mock Test exam lock
Files: main.html (cache-bust teacher-app.js?v=54), teacher-app.js, V38_MOCK_EXAM_LOCK.sql (run once in Supabase SQL editor; needs V13; safe to re-run).
- Exit button removed; Back blocked; refresh/close prompts; right-click/copy/paste/shortcuts blocked; full screen requested.
- Leaving tab/full screen is counted (3 = auto-submit). Teacher result shows "Left test" column.
- Timer: server deadline, re-synced every 30 s; amber <5 min, red <1 min; banners at 10/5/1 min; overlay + auto-submit at 0 (retries if offline).
- Refresh during a test resumes it at the same time.
- Submit button asks for confirmation with the unanswered count; "Finish & Submit" on Q80 now works.
- Database job submits expired attempts every minute even if the browser is closed (pg_cron).
Limit: the number of exits (MOCK_MAX_LEAVES=3) is one constant in main.html.
