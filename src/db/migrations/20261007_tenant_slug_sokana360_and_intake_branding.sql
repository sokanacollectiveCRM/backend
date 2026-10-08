-- Sokana360 tenant slug + per-org public intake branding columns.
-- Safe to run more than once.

UPDATE public.tenants
SET slug = 'sokana360', name = 'Sokana360', updated_at = now()
WHERE id = '11111111-1111-4111-8111-111111111111';

ALTER TABLE public.tenant_settings
  ADD COLUMN IF NOT EXISTS brand_display_name text,
  ADD COLUMN IF NOT EXISTS logo_path text,
  ADD COLUMN IF NOT EXISTS logo_mark_path text,
  ADD COLUMN IF NOT EXISTS intake_page_title text,
  ADD COLUMN IF NOT EXISTS intake_notification_email text,
  ADD COLUMN IF NOT EXISTS intake_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS brand_primary_color text,
  ADD COLUMN IF NOT EXISTS brand_accent_color text;

UPDATE public.tenant_settings
SET
  brand_display_name = 'Sokana360',
  logo_path = '/sokana360-logo.png',
  logo_mark_path = '/sokana360-mark.png',
  intake_page_title = 'Request for Service',
  intake_notification_email = 'hello@sokanacollective.com',
  intake_enabled = true,
  brand_primary_color = '#009688',
  brand_accent_color = '#00bcd4',
  updated_at = now()
WHERE tenant_id = '11111111-1111-4111-8111-111111111111';

UPDATE public.tenant_settings
SET
  brand_display_name = coalesce(brand_display_name, 'Synthetic Tenant B'),
  intake_page_title = coalesce(intake_page_title, 'Request for Service'),
  intake_enabled = coalesce(intake_enabled, true),
  updated_at = now()
WHERE tenant_id = '22222222-2222-4222-8222-222222222222';
