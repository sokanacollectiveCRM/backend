import { getPool } from '../../db/cloudSqlPool';

export default async function upsertInternalCustomer(
  internalCustomerId: string,
  fullName: string,
  email: string
): Promise<{ id: string; name: string; email: string }> {
  const { rows } = await getPool().query<{
    id: string;
    name: string;
    email: string;
  }>(
    `
    INSERT INTO public.customers (id, name, email, updated_at)
    VALUES ($1::uuid, $2, $3, NOW())
    ON CONFLICT (id) DO UPDATE
      SET name = EXCLUDED.name,
          email = EXCLUDED.email,
          updated_at = NOW()
    RETURNING id, name, email
    `,
    [internalCustomerId, fullName, email]
  );
  if (!rows[0]) {
    throw new Error('Cloud SQL did not return the upserted customer');
  }
  return rows[0];
}
