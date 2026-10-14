import { getPool } from '../db/cloudSqlPool';
import { submitDoulaProfile } from '../features/doulas/application/submitDoulaProfile';
import {
  missingProfileFields,
  validateCertifications,
} from '../features/doulas/domain/profile';
import { DoulaController } from '../features/doulas/http/doulaController';

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
      updateTeamMember: jest
        .fn()
        .mockResolvedValue({
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

describe('submission for review', () => {
  const query = jest.fn(),
    release = jest.fn();
  beforeEach(() => {
    jest.clearAllMocks();
    (getPool as jest.Mock).mockReturnValue({
      connect: async () => ({ query, release }),
    });
  });
  function setup(existing = false, certificate = true) {
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE'))
        return {
          rows: [
            {
              ...complete,
              full_name: 'Maya Rivers',
              profile_submitted_at: existing ? '2026-10-13T00:00:00Z' : null,
            },
          ],
        };
      if (sql.includes('FROM public.doula_documents'))
        return { rowCount: certificate ? 1 : 0, rows: [] };
      if (sql.includes('to_regclass'))
        return { rows: [{ name: 'dashboard_notices' }] };
      if (sql.includes('RETURNING profile_submitted_at'))
        return { rows: [{ profile_submitted_at: '2026-10-13T00:00:00Z' }] };
      return { rows: [], rowCount: 1 };
    });
  }
  it('records one tenant-scoped notice and timestamp atomically', async () => {
    setup();
    await submitDoulaProfile('doula', 'tenant');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.dashboard_notices'),
      [
        'tenant',
        'doula',
        expect.stringContaining('/hours/doula'),
        'doula-profile-submitted:tenant:doula',
      ]
    );
    expect(query).toHaveBeenCalledWith('COMMIT');
  });
  it('does not notify again on repeated submission', async () => {
    setup(true);
    await submitDoulaProfile('doula', 'tenant');
    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(
      false
    );
  });
  it('requires a training certificate and rolls back on failure', async () => {
    setup(false, false);
    await expect(submitDoulaProfile('doula', 'tenant')).rejects.toThrow(
      'training certificate'
    );
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });
  it('does not accept a profile outside the tenant', async () => {
    query.mockResolvedValue({ rows: [] });
    await expect(submitDoulaProfile('doula', 'other-tenant')).rejects.toThrow(
      'Profile not found'
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tenant_id=$2::uuid'),
      ['doula', 'other-tenant']
    );
  });
});
