import 'dotenv/config';

import { getPool } from '../src/db/cloudSqlPool';

const EXECUTE = process.argv.includes('--execute');

async function main(): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { rows: counts } = await client.query<{
      legacy: string;
      native: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE signing_provider IS DISTINCT FROM 'native')::text AS legacy,
        COUNT(*) FILTER (WHERE signing_provider = 'native')::text AS native
      FROM public.phi_contracts
    `);

    console.log('Before delete:', counts[0]);

    const { rows: related } = await client.query<{
      payments: string;
      schedules: string;
      reminders: string;
    }>(`
      WITH legacy AS (
        SELECT id
        FROM public.phi_contracts
        WHERE signing_provider IS DISTINCT FROM 'native'
      )
      SELECT
        (SELECT COUNT(*)::text FROM public.payments p JOIN legacy l ON l.id = p.contract_id) AS payments,
        (SELECT COUNT(*)::text FROM public.payment_schedules ps JOIN legacy l ON l.id = ps.contract_id) AS schedules,
        (
          SELECT COUNT(*)::text
          FROM public.billing_reminder_email_audit b
          JOIN legacy l ON l.id = b.contract_id
        ) AS reminders
    `);

    console.log('Related rows to clear:', related[0]);

    if (!EXECUTE) {
      console.log(
        'Dry run only. Re-run with --execute to delete legacy SignNow rows from phi_contracts.'
      );
      return;
    }

    await client.query('BEGIN');

    const unlinkedPayments = await client.query(
      `
      UPDATE public.payments p
      SET contract_id = NULL
      FROM public.phi_contracts pc
      WHERE p.contract_id = pc.id
        AND pc.signing_provider IS DISTINCT FROM 'native'
      `
    );
    console.log(`Unlinked payments: ${unlinkedPayments.rowCount ?? 0}`);

    const deletedReminders = await client.query(
      `
      DELETE FROM public.billing_reminder_email_audit b
      USING public.phi_contracts pc
      WHERE b.contract_id = pc.id
        AND pc.signing_provider IS DISTINCT FROM 'native'
      `
    );
    console.log(
      `Deleted reminder audit rows: ${deletedReminders.rowCount ?? 0}`
    );

    const deletedContracts = await client.query(
      `
      DELETE FROM public.phi_contracts
      WHERE signing_provider IS DISTINCT FROM 'native'
      `
    );
    console.log(`Deleted legacy contracts: ${deletedContracts.rowCount ?? 0}`);

    const { rows: after } = await client.query<{
      legacy: string;
      native: string;
    }>(`
      SELECT
        COUNT(*) FILTER (WHERE signing_provider IS DISTINCT FROM 'native')::text AS legacy,
        COUNT(*) FILTER (WHERE signing_provider = 'native')::text AS native
      FROM public.phi_contracts
    `);

    console.log('After delete:', after[0]);

    await client.query('COMMIT');
    console.log('Done.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
