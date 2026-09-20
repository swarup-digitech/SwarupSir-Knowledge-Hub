-- DEPRECATED: use single_submission_until_reassigned.sql instead.
--
-- Current policy:
--   One submission per student per current assignment attempt.
--   Teacher re-assignment opens the next attempt.
--
-- Do not run this old migration because it creates the obsolete
-- (assignment_id, student_id) unique index.

select 'Run single_submission_until_reassigned.sql' as instruction;
