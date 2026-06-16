const mockQuery = jest.fn();

jest.mock('../db/cloudSqlPool', () => ({
  getPool: () => ({
    query: mockQuery,
  }),
}));

import { CloudSqlTeamService } from '../services/cloudSqlTeamService';

describe('CloudSqlTeamService availability summary', () => {
  let service: CloudSqlTeamService;

  beforeEach(() => {
    mockQuery.mockReset();
    service = new CloudSqlTeamService();
    (service as any).doulaAvailabilityService = {
      getAvailabilityStatusForDoulas: jest.fn().mockResolvedValue(
        new Map([
          [
            '123e4567-e89b-12d3-a456-426614174000',
            {
              status: 'available',
              reason: null,
              startAt: null,
              endAt: null,
            },
          ],
        ])
      ),
    };
  });

  it('returns scheduling and availability summary fields for doulas in team/all payloads', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          id: '123e4567-e89b-12d3-a456-426614174000',
          full_name: 'Avery Jones',
          email: 'avery@example.com',
          phone: '555-1212',
          account_status: 'approved',
          address: null,
          city: null,
          state: null,
          country: null,
          zip_code: null,
          bio: null,
          profile_picture: null,
          languages_other_than_english: null,
          scheduling_url: 'https://calendar.example.com/avery',
          role: 'doula',
          created_at: '2026-06-01T00:00:00.000Z',
          updated_at: '2026-06-02T00:00:00.000Z',
        },
      ],
    });

    const members = await service.listTeamMembers();

    expect(members[0]).toMatchObject({
      id: '123e4567-e89b-12d3-a456-426614174000',
      scheduling_url: 'https://calendar.example.com/avery',
      availability_status: 'available',
      availability_note: null,
      unavailable_from: null,
      unavailable_until: null,
    });
  });
});
