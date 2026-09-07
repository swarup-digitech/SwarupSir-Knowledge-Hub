-- Swarup Sir's Knowledge Hub
-- Adds student class type support for Teacher > Student Accounts.
-- Run this once in Supabase SQL Editor if profiles.class_type does not already exist.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_type text;

COMMENT ON COLUMN public.profiles.class_type IS
  'Teacher-managed student class type/category.';
