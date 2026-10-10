import { getPool } from '../../../db/cloudSqlPool';

export async function isPlatformSupportPrincipal(input: {
  userId?: string | null;
  email?: string | null;
}): Promise<boolean> {
  const userId = input.userId?.trim() || '';
  const email = input.email?.trim().toLowerCase() || '';
  if (!userId && !email) return false;
  try {
    const { rows } = await getPool().query<{ ok: number }>(
      `SELECT 1 AS ok
       FROM public.platform_admins
       WHERE ($1 <> '' AND identity_platform_uid = $1)
          OR ($2 <> '' AND lower(email) = $2)
       LIMIT 1`,
      [userId, email]
    );
    return Boolean(rows[0]);
  } catch (error) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
    if (code === '42P01') return false;
    throw error;
  }
}
