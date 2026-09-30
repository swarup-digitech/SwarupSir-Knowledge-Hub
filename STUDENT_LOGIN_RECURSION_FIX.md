# Student Dashboard "too much recursion" fix

The issue was caused by a recursive fallback in `studentDisplayName()`:

`profile?.display_name || studentDisplayName()`

If `display_name` was empty, the function called itself forever. It is now replaced with a non-recursive fallback using display_name, name/full_name/student_name, roll_no, then `Student`.

The service-worker cache version was also bumped from v7 to v8 so browsers fetch the corrected frontend.
