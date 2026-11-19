-- Match Sokana360 intake theme to logo: navy (Sokana) + terracotta (360).
UPDATE public.tenant_settings
SET
  brand_primary_color = '#0A3147',
  brand_accent_color = '#D6704D',
  updated_at = now()
WHERE tenant_id = '11111111-1111-4111-8111-111111111111';
