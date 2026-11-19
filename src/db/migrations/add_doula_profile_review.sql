-- Admin review state for doula profile information.
ALTER TABLE public.doulas
  ADD COLUMN IF NOT EXISTS profile_review_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS profile_review_reason text,
  ADD COLUMN IF NOT EXISTS profile_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS profile_reviewed_by text;

UPDATE public.doulas
SET profile_review_status = 'approved'
WHERE lower(COALESCE(account_status, '')) IN ('active', 'approved')
  AND profile_review_status IN ('draft', 'not_submitted');

-- Existing deployments use `draft` and `profile_review_reason`; retain those
-- fields and allow the additional `pending` and `rejected` review states.
