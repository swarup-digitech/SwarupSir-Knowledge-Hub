SWARUP SIR'S KNOWLEDGE HUB — COMPLETE RESTORED PACKAGE

PRIMARY EDIT FILE
- main.html is the main application file. Keep making normal UI/function changes here.
- index.html is only a tiny root redirect to student-login.html so the package also works when opened at the site root.

RESTORED CORE FUNCTIONS
1. Teacher and student separate login.
2. Student login by Roll No + Password.
3. Classes, students, bulk student Excel import and student account management.
4. Two assignment types:
   - With Video: student watches the lesson video before questions.
   - Without Video: student goes directly to questions.
5. Assignment to an entire class or selected students.
6. Manual MCQ creation.
7. Bulk MCQ import:
   - PDF + separate Answer Key Excel.
   - PDF image-per-page mode; large white margins are automatically trimmed.
   - Questions Excel + separate Answer Key Excel.
8. Answer Key Excel supports:
   Question No | Correct Option | Explanation (optional)
9. Per-question hints.
10. Per-question YouTube solution videos, shown after submission.
11. Per-question Explanation, optional, shown after submission near Answer Key and solution video.
12. Two-tab teacher question editor: Edit Questions / Hints-Solution Videos-Explanation.
13. Student dashboard tabs:
   - New Assignments
   - Previous — With Video
   - Previous — Without Video
14. Student Previous Work has:
   - Correct Answers tab
   - Wrong Answers tab
   - Wrong questions in red
   - Answer Key in dark green
   - Student selection
   - Optional Explanation
   - Optional solution video
15. Teacher Results has summary first, with Correct Answers / Wrong Answers tabs for details.
16. Percentage shown with submitted score.
17. One submission per student per assignment.
18. Teacher can delete an attempt or fresh-reassign an assignment.
19. A submitted assignment is locked; another attempt is allowed only after explicit teacher re-assignment.
20. Results Excel export.
21. PWA support and app icons.

DATABASE
Run complete_database_migrations.sql once in Supabase SQL Editor.
It combines the feature migrations for Roll No login, credentials, hints, solution videos,
explanations and teacher deletes. For the current submission/re-assignment policy, also run
single_submission_until_reassigned.sql once.
The individual SQL files are also included for reference.

EDGE FUNCTION
- supabase/functions/create-students/index.ts
- Function name: create-students
- Deploy this function if your deployed version does not already contain the current actions.
- It supports studentLogin, createStudents, listCredentials, setStudentRollNo,
  setStudentPassword and deleteStudent.
- The classroom bulk/single student creator can generate an internal Auth email automatically
  when the teacher supplies only Name, Roll No, Class and Password.

DEPLOYMENT
1. Back up the current main.html.
2. Replace it with the package main.html.
3. Deploy the web files to Cloudflare Pages.
4. If using the bundled Supabase function, deploy create-students with your Supabase project.
5. Run complete_database_migrations.sql in Supabase SQL Editor.
6. Do not put SQL files in the public website as executable code; they are setup/reference files.
7. If an old PWA version remains cached, close the installed app/browser tab and reload after the service worker updates.

BULK QUESTION ANSWER KEY FORMAT
Question No | Correct Option | Explanation
1           | B              | Optional explanation text.
2           | D              | Optional explanation text.
3           | A              |

For PDF image-per-page import, each PDF page becomes one question image. White page margins are
trimmed automatically before the image is stored for display.
