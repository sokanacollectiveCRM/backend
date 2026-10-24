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
  phone_number: '5555550100',
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
          expiration_date: '2028-03-31',
          no_expiration: false,
          admin: true,
        },
      ])
    ).toEqual([
      {
        name: 'Birth doula',
        issuingOrganization: 'Example',
        expiration_date: '2028-03-31',
        no_expiration: false,
      },
    ]);
  });
  it.each([
    null,
    {},
    Array(21).fill({}),
    [{ name: '', issuingOrganization: 'Example', expiration_date: null }],
    [{ name: 'a'.repeat(121), issuingOrganization: '', year: '' }],
    [
      {
        name: 'Valid',
        issuingOrganization: 'Org',
        expiration_date: '2028-02-30',
      },
    ],
  ])('rejects malformed certification payload %#', (value) => {
    expect(() => validateCertifications(value)).toThrow();
  });
  it('saves a real date and explicit No expiration and drops every blank row', () => {
    expect(
      validateCertifications([
        {
          name: 'Fictional training',
          issuingOrganization: 'Example',
          expiration_date: '2028-02-29',
        },
        {
          name: 'Fictional lifetime training',
          issuingOrganization: '',
          expiration_date: null,
          no_expiration: true,
        },
        {
          name: ' ',
          issuingOrganization: '',
          expiration_date: null,
          no_expiration: false,
        },
        { name: '', issuingOrganization: '', no_expiration: true },
      ])
    ).toEqual([
      {
        name: 'Fictional training',
        issuingOrganization: 'Example',
        expiration_date: '2028-02-29',
        no_expiration: false,
      },
      {
        name: 'Fictional lifetime training',
        issuingOrganization: '',
        expiration_date: null,
        no_expiration: true,
      },
    ]);
  });
  it.each([
    '2027-02-29',
    '2028-02-30',
    '2028-13-01',
    '2028-03-00',
    '03/31/2028',
    '0000-01-01',
    2028,
  ])('rejects an invalid expiration date %s', (expiration_date) => {
    expect(() =>
      validateCertifications([
        { name: 'Fictional', issuingOrganization: 'Example', expiration_date },
      ])
    ).toThrow(/valid date/);
  });
  it('rejects contradicting expiry fields and nonboolean no-expiration choices', () => {
    expect(() =>
      validateCertifications([
        {
          name: 'Fictional',
          issuingOrganization: '',
          expiration_date: '2028-03-31',
          no_expiration: true,
        },
      ])
    ).toThrow(/cannot have/);
    expect(() =>
      validateCertifications([
        { name: 'Fictional', issuingOrganization: '', no_expiration: 'true' },
      ])
    ).toThrow(/true or false/);
  });
  it('retains legacy year data without inferring an expiration date', () => {
    expect(
      validateCertifications([
        { name: 'Fictional legacy', issuingOrganization: '', year: '2020' },
      ])
    ).toEqual([
      {
        name: 'Fictional legacy',
        issuingOrganization: '',
        year: '2020',
        expiration_date: null,
        no_expiration: false,
      },
    ]);
  });
  it('returns 400 for an invalid expiration date before any profile write', async () => {
    const controller = Object.create(DoulaController.prototype) as any;
    controller.cloudSqlTeamService = { updateTeamMember: jest.fn() };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller.updateMyProfile(
      {
        user: { id: 'fictional-doula' },
        body: {
          phone_number: '5555550100',
          certifications: [
            {
              name: 'Fictional training',
              issuingOrganization: 'Example',
              expiration_date: '2028-02-30',
            },
          ],
        },
      },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(
      controller.cloudSqlTeamService.updateTeamMember
    ).not.toHaveBeenCalled();
  });
  it('serializes legacy expiration fields without converting the historical year', () => {
    const controller = Object.create(DoulaController.prototype) as any;
    const payload = controller.buildDoulaProfilePayload({
      id: 'fictional-doula',
      firstname: 'Maya',
      lastname: 'Rivers',
      certifications: [
        { name: 'Fictional legacy', issuingOrganization: '', year: '2020' },
      ],
    });
    expect(payload.certifications).toEqual([
      {
        name: 'Fictional legacy',
        issuingOrganization: '',
        year: '2020',
        expiration_date: null,
        no_expiration: false,
      },
    ]);
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
          phone_number: '555-555-0100',
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
        phone_number: '5555550100',
        bio: 'I am a doula.',
        pronouns: null,
        race_ethnicity: [],
        certifications: [],
      }
    );
  });
});
