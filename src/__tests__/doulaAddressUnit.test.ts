import { getPool } from '../db/cloudSqlPool';
import {
  missingProfileFields,
  normalizeUnitNumber,
} from '../features/doulas/domain/profile';
import { CloudSqlTeamService } from '../services/cloudSqlTeamService';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/gcs/profilePictureStorage', () => ({
  resolveProfilePictureUrl: async (v: unknown) => v,
  resolveProfilePictureFields: async (v: unknown) => v,
}));

describe('P-19 doula address storage', () => {
  const existing: any = {
    id: 'fictional',
    role: 'doula',
    fullName: 'Maya Rivers',
    firstname: 'Maya',
    lastname: 'Rivers',
    email: 'maya@example.com',
    phone_number: '5555550100',
    address: '100 Fictional Way',
    city: 'Chicago',
    state: 'IL',
    zip_code: '60601',
    unit_number: 'Apt 4B',
    country: null,
  };
  function setup(country: string | null = null) {
    const service = new CloudSqlTeamService();
    jest
      .spyOn(service, 'getTeamMemberById')
      .mockResolvedValue({ ...existing, country });
    const query = jest.fn().mockImplementation(async (_sql, args) => ({
      rows: [
        {
          id: existing.id,
          full_name: existing.fullName,
          email: existing.email,
          unit_number: args[20],
          country: args[6],
        },
      ],
    }));
    (getPool as jest.Mock).mockReturnValue({ query });
    return { service, query };
  }
  it('defaults missing country on save and round-trips a normalized unit', async () => {
    const { service, query } = setup();
    const saved = await service.updateTeamMember(existing.id, {
      unit_number: ' Apt 4B ',
    });
    expect(query.mock.calls[0][1][6]).toBe('United States');
    expect(saved?.unit_number).toBe('Apt 4B');
  });
  it.each(['US', 'United States', 'Canada'])(
    'preserves existing country %s regardless of incoming value',
    async (country) => {
      const { service, query } = setup(country);
      await service.updateTeamMember(existing.id, { country: 'Changed' });
      expect(query.mock.calls[0][1][6]).toBe(country);
      expect(query.mock.calls[0][1][20]).toBe('Apt 4B');
    }
  );
  it.each(['', ' ', null])(
    'allows clearing optional unit %p',
    async (unit_number) => {
      const { service } = setup();
      expect(
        (await service.updateTeamMember(existing.id, { unit_number }))
          ?.unit_number
      ).toBeNull();
    }
  );
  it.each([55, {}, 'A'.repeat(101), 'Apt\n4B'])(
    'rejects invalid unit %p before SQL update',
    async (unit_number) => {
      const { service, query } = setup();
      await expect(
        service.updateTeamMember(existing.id, { unit_number } as any)
      ).rejects.toThrow();
      expect(query).not.toHaveBeenCalled();
    }
  );
  it('does not require country or unit for completion', () => {
    const missing = missingProfileFields({
      ...existing,
      phone: existing.phone_number,
      bio: 'Fictional doula bio',
      unit_number: null,
      country: null,
    });
    expect(missing).not.toContain('country');
    expect(missing).not.toContain('unit_number');
    expect(normalizeUnitNumber('4B')).toBe('4B');
  });
});
