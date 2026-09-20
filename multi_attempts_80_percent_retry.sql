-- Swarup Sir's Knowledge Hub
-- One submission per CURRENT attempt + automatic below-80% retry
--
-- This file is retained for compatibility/documentation.
-- Run single_submission_until_reassigned.sql for the complete migration.
--
-- Rules:
--   1. One submission is allowed for a student's current assignment attempt.
--   2. A double-click cannot create a second submission.
--   3. If the score is below 80%, the current submission is automatically
--      removed after 3 hours, making that current attempt available again.
--   4. Teacher re-assignment can also advance the attempt number immediately.
--   5. Scores of 80% or more remain completed.

select 'Run single_submission_until_reassigned.sql for the complete migration.' as instruction;
