
# Final consistency corrections included

This corrected package fixes the following issues found in the uploaded GitHub snapshot:

1. Student login routing is course-aware even when a cached profile exists.
   - SCHOOL → `main.html?mode=student&portal=SCHOOL`
   - JNVST-6/JNVST-9 → `main.html?mode=student`
2. School and JNVST logins no longer rely on an inconsistent generic redirect.
3. Main PWA manifest/icon references use the supplied SKH icons; stale `icon-192.png` / `icon-512.png` references are removed.
4. Student service-worker cache includes `main.html` and the current SKH icons.
5. Main Teacher Student Accounts no longer offers Roll No editing. Roll No is fixed once assigned.
6. `create-students` now:
   - stores the student's course in `profiles.course`;
   - allows School students without manually supplied email;
   - automatically generates a safe internal email;
   - requires the selected class course to match the student's course;
   - enforces School sub-division/course rules;
   - supports name/password/class/sub-division management and student deletion;
   - rejects Roll No changes.
7. School Assessment schema/RLS is included in `school_assessment_course_migration.sql`.
8. School Assessment review lock remains compatible with teacher re-assignment by setting `is_current=false`.

After deployment, clear the old PWA/shortcut once on a test phone and reinstall it so the new manifest/icon/service-worker are picked up.
