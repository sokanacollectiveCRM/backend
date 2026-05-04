jest.mock('../db/cloudSqlPool', () => ({
  queryCloudSql: jest.fn(),
}));

import { queryCloudSql } from '../db/cloudSqlPool';
import { SupabaseUserRepository } from '../repositories/supabaseUserRepository';

describe('SupabaseUserRepository hour persistence', () => {
  const mockQueryCloudSql = queryCloudSql as jest.MockedFunction<typeof queryCloudSql>;
  const repository = new SupabaseUserRepository({} as any);

  beforeEach(() => {
    mockQueryCloudSql.mockReset();
  });

  it('includes type when creating a new hour entry', async () => {
    mockQueryCloudSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'hour-1',
          doula_id: 'doula-1',
          client_id: 'client-1',
          start_time: '2026-04-23T10:00:00.000Z',
          end_time: '2026-04-23T11:00:00.000Z',
          type: 'prenatal',
        },
      ],
      rowCount: 1,
    });

    const result = await repository.addNewHours(
      'doula-1',
      'client-1',
      new Date('2026-04-23T10:00:00.000Z'),
      new Date('2026-04-23T11:00:00.000Z'),
      '',
      'prenatal'
    );

    expect(mockQueryCloudSql).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.hours (doula_id, client_id, start_time, end_time, type, created_at, updated_at)'),
      ['doula-1', 'client-1', new Date('2026-04-23T10:00:00.000Z'), new Date('2026-04-23T11:00:00.000Z'), 'prenatal']
    );
    expect(result.type).toBe('prenatal');
  });

  it('updates type for an existing hour entry', async () => {
    mockQueryCloudSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'hour-1',
          doula_id: 'doula-1',
          client_id: 'client-1',
          start_time: '2026-04-23T10:00:00.000Z',
          end_time: '2026-04-23T11:00:00.000Z',
          type: 'postpartum',
        },
      ],
      rowCount: 1,
    });

    const result = await repository.updateHourType('hour-1', 'postpartum', 'doula-1');

    expect(mockQueryCloudSql).toHaveBeenCalledWith(
      expect.stringContaining('AND doula_id = $3::uuid'),
      ['postpartum', 'hour-1', 'doula-1']
    );
    expect(result?.type).toBe('postpartum');
  });

  it('selects the type field and preserves null for legacy rows', async () => {
    mockQueryCloudSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'hour-1',
          start_time: '2026-04-23T10:00:00.000Z',
          end_time: '2026-04-23T11:00:00.000Z',
          type: null,
          doula_id: 'doula-1',
          doula_full_name: 'Jane Doe',
          client_id: 'client-1',
          client_first_name: 'Client',
          client_last_name: 'One',
        },
      ],
      rowCount: 1,
    });

    const result = await repository.getHoursById('doula-1');

    expect(mockQueryCloudSql).toHaveBeenCalledWith(
      expect.stringContaining('h.type'),
      ['doula-1']
    );
    expect(result[0].type).toBeNull();
  });

  it('selects the type field for all hours', async () => {
    mockQueryCloudSql.mockResolvedValueOnce({
      rows: [
        {
          id: 'hour-1',
          start_time: '2026-04-23T10:00:00.000Z',
          end_time: '2026-04-23T11:00:00.000Z',
          type: 'prenatal',
          doula_id: 'doula-1',
          doula_full_name: 'Jane Doe',
          client_id: 'client-1',
          client_first_name: 'Client',
          client_last_name: 'One',
        },
      ],
      rowCount: 1,
    });

    const result = await repository.getAllHours();

    expect(mockQueryCloudSql).toHaveBeenCalledWith(expect.stringContaining('h.type'));
    expect(result[0].type).toBe('prenatal');
  });
});
