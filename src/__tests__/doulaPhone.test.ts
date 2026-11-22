import { getPool } from '../db/cloudSqlPool';
import { transitionDoulaProfile } from '../features/doulas/application/submitDoulaProfile';
import {
  missingProfileFields,
  normalizePhone,
} from '../features/doulas/domain/profile';
import { DoulaController } from '../features/doulas/http/doulaController';

jest.mock('../db/cloudSqlPool', () => ({ getPool: jest.fn() }));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));

describe('P-15 doula phone validation', () => {
  it.each(['5555550100', '555-555-0100'])(
    'stores %s as ten digits',
    (value) => {
      expect(normalizePhone(value)).toBe('5555550100');
    }
  );
  it.each([
    undefined,
    null,
    '',
    '555555010',
    '55555501000',
    '555555010a',
    '5555550100abc',
    5555550100,
    '+15555550100',
  ])('rejects missing or invalid phone %p', async (value) => {
    expect(() => normalizePhone(value)).toThrow(
      'Enter a 10-digit phone number'
    );
    const controller = Object.create(DoulaController.prototype) as any;
    controller.cloudSqlTeamService = { updateTeamMember: jest.fn() };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await controller.updateMyProfile(
      { user: { id: 'fictional' }, body: { phone_number: value } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Enter a 10-digit phone number',
    });
    expect(
      controller.cloudSqlTeamService.updateTeamMember
    ).not.toHaveBeenCalled();
  });
  it('counts missing and invalid phone as incomplete', () => {
    expect(missingProfileFields({ phone: null })).toContain('phone_number');
    expect(missingProfileFields({ phone: 'abc' })).toContain('phone_number');
    expect(missingProfileFields({ phone: '5555550100' })).not.toContain(
      'phone_number'
    );
  });
  it('accepts incomplete draft fields only for profile autosave', async () => {
    const controller = Object.create(DoulaController.prototype) as any;
    controller.cloudSqlTeamService = {
      updateTeamMember: jest.fn().mockResolvedValue({
        id: 'fictional',
        role: 'doula',
        firstname: '',
        lastname: '',
        email: 'fictional@example.com',
      }),
    };
    controller.doulaAvailabilityService = {
      getCurrentAvailabilityStatus: jest.fn().mockResolvedValue(null),
    };
    const res: any = { json: jest.fn(), status: jest.fn().mockReturnThis() };

    await controller.updateMyProfile(
      {
        user: { id: 'fictional', toJSON: () => ({}) },
        body: {
          phone_number: '555-',
          address: '',
          city: '',
          state: '',
          zip_code: '',
          bio: '',
        },
        get: (name: string) =>
          name.toLowerCase() === 'x-profile-autosave' ? 'true' : undefined,
      },
      res
    );

    expect(
      controller.cloudSqlTeamService.updateTeamMember
    ).toHaveBeenCalledWith(
      'fictional',
      expect.objectContaining({
        phone_number: '555',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        bio: '',
      })
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
  it.each(['submitted', 'approved'] as const)(
    'blocks %s without a phone, including an already submitted profile',
    async (action) => {
      const client = {
        query: jest.fn().mockResolvedValue({
          rows: [{ profile_review_status: 'submitted', phone: null }],
        }),
        release: jest.fn(),
      };
      (getPool as jest.Mock).mockReturnValue({ connect: async () => client });
      await expect(
        transitionDoulaProfile({
          doulaId: 'fictional',
          tenantId: 'fictional',
          actorId: 'fictional',
          action,
        })
      ).rejects.toThrow('Enter a 10-digit phone number');
      expect(client.query).not.toHaveBeenCalledWith(
        expect.stringMatching(/^\s*UPDATE /),
        expect.anything()
      );
    }
  );
});
