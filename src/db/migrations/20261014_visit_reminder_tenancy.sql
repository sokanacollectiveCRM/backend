-- New visit delivery rows explicitly carry their owning tenant.
ALTER TABLE public.notification_deliveries ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX IF NOT EXISTS notification_deliveries_tenant_idx ON public.notification_deliveries(tenant_id, created_at);
