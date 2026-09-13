-- Add an optional explanation to each question.
-- Run this once in Supabase SQL Editor.

ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS explanation text;

COMMENT ON COLUMN public.questions.explanation IS
'Optional explanation shown to students after submission, near the answer key and solution video.';
