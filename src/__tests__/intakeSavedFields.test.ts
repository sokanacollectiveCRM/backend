import type { SupabaseClient } from '@supabase/supabase-js';

import { getPool } from '../db/cloudSqlPool';
import { RequestFormRepository } from '../repositories/requestFormRepository';
import type { RequestFormData } from '../types';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));

it('writes family name, contacts, requested services, due date and notes in the initial lead INSERT', async () => {
  const query = jest
    .fn()
    .mockResolvedValue({ rows: [{ client_number: 'CL-TEST' }] });
  (getPool as jest.Mock).mockReturnValue({ query });
  const repo = new RequestFormRepository({} as SupabaseClient);
  await repo.saveData({
    firstname: 'Maya',
    lastname: 'Rivers',
    email: 'jerry+family@example.com',
    phone_number: '5551234567',
    address: '1 Fictional Lane',
    service_needed: 'Labor Support',
    services_interested: ['Labor Support'],
    due_date: '2027-03-15',
    health_notes: 'Fictional notes',
    service_support_details: 'Fictional service preferences',
  } as RequestFormData);
  expect(query).toHaveBeenCalledTimes(1);
  const [sql, values] = query.mock.calls[0];
  const columns = sql
    .match(/INSERT INTO phi_clients\s*\(([\s\S]*?)\) VALUES/)[1]
    .split(',')
    .map((name: string) => name.trim())
    .filter((name: string) => name !== 'client_number');
  const inserted = Object.fromEntries(
    columns.map((name: string, i: number) => [name, values[i]])
  );
  expect(inserted).toMatchObject({
    first_name: 'Maya',
    last_name: 'Rivers',
    email: 'jerry+family@example.com',
    phone: '5551234567',
    address_line1: '1 Fictional Lane',
    service_needed: 'Labor Support',
    services_interested: ['Labor Support'],
    due_date: '2027-03-15',
    health_notes: 'Fictional notes',
    service_support_details: 'Fictional service preferences',
    status: 'lead',
  });
});
