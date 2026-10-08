import { getPool } from '../../../db/cloudSqlPool';

export async function findStaffEmailDomain(
  tenantId: string
): Promise<string | null> {
  try {
    const { rows } = await getPool().query<{
      staff_email_domain: string | null;
    }>(
      `SELECT staff_email_domain
         FROM public.tenant_settings
        WHERE tenant_id = $1::uuid`,
      [tenantId]
    );
    const domain = rows[0]?.staff_email_domain?.trim();
    return domain ? domain : null;
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    if (code === '42703' || code === '42P01') return null;
    throw error;
  }
}
