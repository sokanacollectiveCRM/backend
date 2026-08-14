-- Preserve first/last name separately so multi-word first names do not spill into last name.
-- Safe to run multiple times.

ALTER TABLE public.admins
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Backfill from existing full_name (first token / remainder) when empty.
UPDATE public.admins
SET
  first_name = COALESCE(NULLIF(first_name, ''), NULLIF(split_part(full_name, ' ', 1), '')),
  last_name = COALESCE(
    NULLIF(last_name, ''),
    NULLIF(btrim(substring(full_name from length(split_part(full_name, ' ', 1)) + 1)), '')
  )
WHERE first_name IS NULL OR last_name IS NULL;
