const mockQuery = jest.fn();

jest.mock('../db/cloudSqlPool', () => ({
  getPool: () => ({
    query: mockQuery,
  }),
}));

import { ConflictError } from '../domains/errors';
import { DoulaAvailabilityService } from '../services/doulaAvailabilityService';

describe('DoulaAvailabilityService', () => {
  const service = new DoulaAvailabilityService();

  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('throws a conflict when an unavailable period overlaps the requested window', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: 'availability-1',
          doula_id: 'doula-1',
          start_at: '2026-06-20T10:00:00.000Z',
          end_at: '2026-06-20T12:00:00.000Z',
          availability_status: 'unavailable',
          reason: 'vacation',
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-01T00:00:00.000Z',
        },
      ],
    });

    await expect(
      service.assertDoulaAvailableForPeriod(
        'doula-1',
        new Date('2026-06-20T11:00:00.000Z'),
        new Date('2026-06-20T13:00:00.000Z')
      )
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('allows requests when no overlap exists', async () => {
    mockQuery.mockResolvedValue({ rows: [] });

    await expect(
      service.assertDoulaAvailableForPeriod(
        'doula-1',
        new Date('2026-06-20T13:00:00.000Z'),
        new Date('2026-06-20T14:00:00.000Z')
      )
    ).resolves.toBeUndefined();
  });
});
