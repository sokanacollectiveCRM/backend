BEGIN;
ALTER TABLE public.doulas
 ADD COLUMN IF NOT EXISTS profile_review_status text NOT NULL DEFAULT 'draft',
 ADD COLUMN IF NOT EXISTS profile_review_reason text,
 ADD COLUMN IF NOT EXISTS profile_review_version integer NOT NULL DEFAULT 0;
UPDATE public.doulas SET profile_review_status=CASE WHEN account_status='approved' THEN 'approved' WHEN profile_submitted_at IS NOT NULL THEN 'submitted' ELSE 'draft' END
 WHERE profile_review_version=0 AND profile_review_status='draft';
CREATE TABLE IF NOT EXISTS public.doula_profile_reviews (
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL, doula_id uuid NOT NULL REFERENCES public.doulas(id) ON DELETE CASCADE,
 version integer NOT NULL, action text NOT NULL CHECK(action IN ('submitted','changes_requested','approved')),
 reason text, actor_id text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(doula_id,version)
);
CREATE TABLE IF NOT EXISTS public.doula_review_emails (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), event_id uuid NOT NULL REFERENCES public.doula_profile_reviews(id) ON DELETE CASCADE,
 recipient text NOT NULL, subject text NOT NULL, body text NOT NULL,
 attempts integer NOT NULL DEFAULT 0, sent_at timestamptz, retry_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(event_id,recipient)
);
COMMIT;
