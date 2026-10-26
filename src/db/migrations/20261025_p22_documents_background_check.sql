BEGIN;
-- Additive: retain every historical document row and file, including retired types.
ALTER TABLE public.doula_documents DROP CONSTRAINT IF EXISTS doula_documents_document_type_check;
ALTER TABLE public.doula_documents ADD CONSTRAINT doula_documents_document_type_check CHECK
(document_type IN ('training_certificate','w9','direct_deposit_form','cpr','hipaa',
'liability_insurance_certificate','illinois_medicaid_certification','miscellaneous','license','other','background_check')) NOT VALID;
ALTER TABLE public.doula_documents VALIDATE CONSTRAINT doula_documents_document_type_check;
ALTER TABLE public.doulas
 ADD COLUMN IF NOT EXISTS background_check_status text NOT NULL DEFAULT 'not_cleared' CHECK(background_check_status IN ('not_cleared','cleared')),
 ADD COLUMN IF NOT EXISTS background_check_set_at timestamptz,
 ADD COLUMN IF NOT EXISTS background_check_set_by text;
CREATE TABLE IF NOT EXISTS public.doula_hr_permissions (
 tenant_id uuid NOT NULL, admin_id text NOT NULL,
 department text NOT NULL CHECK(department IN ('hr','payroll')),
 PRIMARY KEY(tenant_id,admin_id)
);
CREATE TABLE IF NOT EXISTS public.doula_background_check_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL,
 doula_id uuid NOT NULL REFERENCES public.doulas(id),
 status text NOT NULL CHECK(status IN ('not_cleared','cleared')),
 actor_id text NOT NULL, set_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_user') THEN
  GRANT SELECT ON public.doula_hr_permissions TO app_user;
  GRANT SELECT, INSERT ON public.doula_background_check_events TO app_user;
 END IF;
END $$;
-- No automatic HR/payroll grants. P-23 will own staff permission provisioning.
COMMIT;
