-- Admin staff invites must use this domain (doulas and clients may use any email).
-- Clients are not limited by it. Safe to run more than once.

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS staff_email_domain text;

UPDATE public.tenant_settings
SET staff_email_domain = 'sokanacollective.com',
    updated_at = now()
WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
  AND staff_email_domain IS NULL;

UPDATE public.tenant_settings
SET staff_email_domain = 'tenantb.example',
    updated_at = now()
WHERE tenant_id = '22222222-2222-4222-8222-222222222222'
  AND staff_email_domain IS NULL;
