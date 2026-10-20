import { getPool } from '../db/cloudSqlPool';
import {
  missingProfileFields,
  validateCertifications,
} from '../features/doulas/domain/profile';
import { DoulaController } from '../features/doulas/http/doulaController';

const sendEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../services/emailService', () => ({
  NodemailerService: jest.fn().mockImplementation(() => ({ sendEmail })),
}));

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));

const complete = {
  firstname: 'Maya',
  lastname: 'Rivers',
  address: '1 Fictional Way',
  city: 'Chicago',
  state: 'IL',
  country: 'US',
  zip_code: '60601',
  bio: 'I am a doula.',
};
describe('profile layout validation', () => {
  it('allows empty demographics while requiring bio', () => {
    expect(
      missingProfileFields({ ...complete, pronouns: '', race_ethnicity: [] })
    ).toEqual([]);
    expect(missingProfileFields({ ...complete, bio: ' ' })).toEqual(['bio']);
  });
  it('trims certifications and discards unknown properties', () => {
    expect(
      validateCertifications([
        {
          name: ' Birth doula ',
          issuingOrganization: ' Example ',
          year: ' 2026 ',
          admin: true,
        },
      ])
    ).toEqual([
      { name: 'Birth doula', issuingOrganization: 'Example', year: '2026' },
    ]);
  });
  it.each([
    null,
    {},
    Array(21).fill({}),
    [{ name: '', issuingOrganization: '', year: '' }],
    [{ name: 'a'.repeat(121), issuingOrganization: '', year: '' }],
    [{ name: 'Valid', issuingOrganization: 'Org', year: 2026 }],
  ])('rejects malformed certification payload %#', (value) => {
    expect(() => validateCertifications(value)).toThrow();
  });
  it('PUT ignores unknown keys and cannot set approval or submission state', async () => {
    const c = Object.create(DoulaController.prototype) as any;
    c.cloudSqlTeamService = {
      updateTeamMember: jest.fn().mockResolvedValue({
        id: 'doula',
        role: 'doula',
        ...complete,
        fullName: 'Maya Rivers',
        certifications: [],
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      }),
    };
    c.doulaAvailabilityService = {
      getCurrentAvailabilityStatus: jest
        .fn()
        .mockResolvedValue({ status: 'available' }),
    };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await c.updateMyProfile(
      {
        user: { id: 'doula' },
        body: {
          bio: ' I am a doula. ',
          pronouns: '',
          race_ethnicity: [],
          certifications: [],
          unknown: true,
          account_status: 'active',
          profile_submitted_at: '2026-01-01',
        },
      },
      res
    );
    expect(c.cloudSqlTeamService.updateTeamMember).toHaveBeenCalledWith(
      'doula',
      {
        bio: 'I am a doula.',
        pronouns: null,
        race_ethnicity: [],
        certifications: [],
      }
    );
  });
});
