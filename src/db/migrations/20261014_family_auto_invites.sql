-- Durable at-most-once automatic invitations. Manual resend is unaffected.
CREATE TABLE IF NOT EXISTS public.family_auto_invites (
 client_id uuid PRIMARY KEY REFERENCES public.phi_clients(id) ON DELETE CASCADE,
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS family_auto_invites_tenant_idx ON public.family_auto_invites(tenant_id);
