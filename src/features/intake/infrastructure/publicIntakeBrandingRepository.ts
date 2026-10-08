import { getPool } from '../../../db/cloudSqlPool';

export type PublicIntakeBranding = {
  slug: string;
  name: string;
  branding: {
    displayName: string;
    logoPath: string;
    markPath: string | null;
    pageTitle: string;
    primaryColor: string;
    accentColor: string;
  };
};

export type IntakeTenantWriteContext = {
  tenantId: string;
  tenantSlug: string;
  notificationEmail: string;
};

type TenantBrandingRow = {
  tenant_id: string;
  slug: string;
  name: string;
  status: string;
  brand_display_name: string | null;
  logo_path: string | null;
  logo_mark_path: string | null;
  intake_page_title: string | null;
  intake_notification_email: string | null;
  intake_enabled: boolean | null;
  brand_primary_color: string | null;
  brand_accent_color: string | null;
};

const DEFAULT_NOTIFICATION_EMAIL = 'hello@sokanacollective.com';
const DEFAULT_PAGE_TITLE = 'Request for Service';
const DEFAULT_PRIMARY_COLOR = '#009688';
const DEFAULT_ACCENT_COLOR = '#00bcd4';

function mapRow(row: TenantBrandingRow): {
  public: PublicIntakeBranding;
  write: IntakeTenantWriteContext;
} {
  const displayName =
    row.brand_display_name?.trim() || row.name?.trim() || row.slug;
  const logoPath = row.logo_path?.trim() || '/sokana360-logo.png';
  const pageTitle = row.intake_page_title?.trim() || DEFAULT_PAGE_TITLE;
  const notificationEmail =
    row.intake_notification_email?.trim() || DEFAULT_NOTIFICATION_EMAIL;

  return {
    public: {
      slug: row.slug,
      name: row.name,
      branding: {
        displayName,
        logoPath,
        markPath: row.logo_mark_path?.trim() || null,
        pageTitle,
        primaryColor: row.brand_primary_color?.trim() || DEFAULT_PRIMARY_COLOR,
        accentColor: row.brand_accent_color?.trim() || DEFAULT_ACCENT_COLOR,
      },
    },
    write: {
      tenantId: row.tenant_id,
      tenantSlug: row.slug,
      notificationEmail,
    },
  };
}

function isMissingSchemaError(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  return code === '42703' || code === '42P01';
}

const BRANDING_QUERY = `
  SELECT
    t.id AS tenant_id,
    t.slug,
    t.name,
    t.status,
    s.brand_display_name,
    s.logo_path,
    s.logo_mark_path,
    s.intake_page_title,
    s.intake_notification_email,
    s.intake_enabled,
    s.brand_primary_color,
    s.brand_accent_color
  FROM public.tenants t
  JOIN public.tenant_settings s ON s.tenant_id = t.id
  WHERE lower(t.slug) = lower($1)
  LIMIT 1
`;

export async function findIntakeTenantBySlug(tenantSlug: string): Promise<{
  public: PublicIntakeBranding;
  write: IntakeTenantWriteContext;
} | null> {
  const slug = tenantSlug.trim();
  if (!slug) return null;

  try {
    const { rows } = await getPool().query<TenantBrandingRow>(BRANDING_QUERY, [
      slug,
    ]);
    const row = rows[0];
    if (!row || row.status !== 'active') return null;
    if (row.intake_enabled === false) return null;
    return mapRow(row);
  } catch (error) {
    if (isMissingSchemaError(error)) return null;
    throw error;
  }
}

export async function getPublicIntakeBrandingBySlug(
  tenantSlug: string
): Promise<PublicIntakeBranding | null> {
  const found = await findIntakeTenantBySlug(tenantSlug);
  return found?.public ?? null;
}
