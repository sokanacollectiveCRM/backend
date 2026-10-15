import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';

import { execFileSync, spawn } from 'child_process';

import { SchedulingConflictError } from '../application/schedulingService';
import { CloudSqlSchedulingStore } from './schedulingStore';

const DOULA_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const MIGRATION = resolve(
  __dirname,
  '../../../db/migrations/add_doula_availability_and_scheduling_cloudsql.sql'
);
const OVERLAP_INDEX = resolve(
  __dirname,
  '../../../db/migrations/20261011_scheduling_booking_overlap_index.sql'
);

const PARENT_SCHEMA = `
CREATE TABLE IF NOT EXISTS public.doulas (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  email text
);
CREATE TABLE IF NOT EXISTS public.phi_clients (
  id uuid PRIMARY KEY,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  client_number text,
  user_id uuid
);
CREATE TABLE IF NOT EXISTS public.doula_assignments (
  client_id uuid NOT NULL,
  doula_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  role text,
  PRIMARY KEY (client_id, doula_id)
);
CREATE TABLE IF NOT EXISTS public.phi_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  status text,
  created_at timestamptz DEFAULT NOW(),
  inserted_at timestamptz DEFAULT NOW()
);
`;

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function waitForPostgres(url: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    const pool = new Pool({ connectionString: url });
    try {
      await pool.query('SELECT 1');
      await pool.end();
      return;
    } catch {
      await pool.end().catch(() => undefined);
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
  }
  throw new Error('Postgres did not become ready');
}

describe('scheduling Cloud SQL integration', () => {
  const envUrl = process.env.SCHEDULING_TEST_DATABASE_URL;
  const useDocker = !envUrl && dockerAvailable();
  const shouldRun = Boolean(envUrl || useDocker);

  if (!shouldRun) {
    it('skips when Docker Postgres is unavailable (set SCHEDULING_TEST_DATABASE_URL to run)', () => {
      expect(envUrl || useDocker).toBeFalsy();
    });
    return;
  }

  let pool: Pool;
  let containerId: string | null = null;
  let connectionString = envUrl || '';

  beforeAll(async () => {
    if (useDocker) {
      const name = `scheduling-mvp-${process.pid}`;
      execFileSync('docker', [
        'run',
        '-d',
        '--rm',
        '--name',
        name,
        '-e',
        'POSTGRES_PASSWORD=postgres',
        '-e',
        'POSTGRES_DB=scheduling_test',
        '-p',
        '55432:5432',
        'postgres:16-alpine',
      ]);
      containerId = name;
      connectionString =
        'postgresql://postgres:postgres@127.0.0.1:55432/scheduling_test';
    }
    await waitForPostgres(connectionString);
    pool = new Pool({ connectionString });
    await pool.query(PARENT_SCHEMA);
    await pool.query(readFileSync(MIGRATION, 'utf8'));
    await pool.query(readFileSync(OVERLAP_INDEX, 'utf8'));
    await pool.query(
      `INSERT INTO public.doulas (id, full_name, email) VALUES ($1, 'Maya Rivers', 'jerry+sokanadoula@techluminateacademy.com')`,
      [DOULA_ID]
    );
    await pool.query(
      `INSERT INTO public.phi_clients (id, first_name, last_name, email, client_number, user_id)
       VALUES ($1, 'Jordan', 'Lake', 'jerry+sokanaclient@techluminateacademy.com', 'CL-PILOT-001', $1)`,
      [CLIENT_ID]
    );
    await pool.query(
      `INSERT INTO public.doula_assignments (client_id, doula_id, status, role)
       VALUES ($1, $2, 'active', 'primary')`,
      [CLIENT_ID, DOULA_ID]
    );
    await pool.query(
      `INSERT INTO public.phi_contracts (client_id, status) VALUES ($1, 'draft')`,
      [CLIENT_ID]
    );
    await pool.query(
      `INSERT INTO public.doula_availability (doula_id, start_at, end_at, availability_status)
       VALUES ($1, '2026-10-20T15:00:00.000Z', '2026-10-20T19:00:00.000Z', 'available')`,
      [DOULA_ID]
    );
  }, 120000);

  afterAll(async () => {
    await pool?.end().catch(() => undefined);
    if (containerId) {
      spawn('docker', ['rm', '-f', containerId], { stdio: 'ignore' });
    }
  });

  it('applies the idempotent scheduling migration and enforces overlap', async () => {
    await pool.query(readFileSync(MIGRATION, 'utf8'));
    const store = new CloudSqlSchedulingStore(pool);
    const first = await store.createBookingInTransaction({
      clientId: CLIENT_ID,
      doulaId: DOULA_ID,
      requestedBy: CLIENT_ID,
      startAt: new Date('2026-10-20T15:00:00.000Z'),
      endAt: new Date('2026-10-20T16:00:00.000Z'),
      notes: null,
    });
    expect(first.status).toBe('pending');

    await expect(
      store.createBookingInTransaction({
        clientId: CLIENT_ID,
        doulaId: DOULA_ID,
        requestedBy: CLIENT_ID,
        startAt: new Date('2026-10-20T15:30:00.000Z'),
        endAt: new Date('2026-10-20T16:30:00.000Z'),
        notes: null,
      })
    ).rejects.toBeInstanceOf(SchedulingConflictError);

    await expect(
      store.createBookingInTransaction({
        clientId: CLIENT_ID,
        doulaId: DOULA_ID,
        requestedBy: CLIENT_ID,
        startAt: new Date('2026-10-21T15:00:00.000Z'),
        endAt: new Date('2026-10-21T16:00:00.000Z'),
        notes: null,
      })
    ).rejects.toMatchObject({ code: 'BOOKING_OUTSIDE_WINDOW' });

    const windows = await store.listAvailabilityIntervals(
      DOULA_ID,
      'available'
    );
    expect(windows).toHaveLength(1);
    expect(await store.assignmentIsActive(CLIENT_ID, DOULA_ID)).toBe(true);
    expect(await store.isClientInContractStage(CLIENT_ID)).toBe(true);
  });
});
