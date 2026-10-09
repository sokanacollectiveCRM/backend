import { ValidationError } from '../../../domains/errors';
import { assertStaffInviteEmail } from '../application/assertStaffInviteEmail';
import { findStaffEmailDomain } from '../infrastructure/staffEmailDomainRepository';

jest.mock('../infrastructure/staffEmailDomainRepository', () => ({
  findStaffEmailDomain: jest.fn(),
}));

const mockFindStaffEmailDomain = findStaffEmailDomain as jest.MockedFunction<
  typeof findStaffEmailDomain
>;

describe('assertStaffInviteEmail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips domain check for doula invites', async () => {
    await assertStaffInviteEmail({
      tenantId: '11111111-1111-4111-8111-111111111111',
      email: 'personal@gmail.com',
      role: 'doula',
    });
    expect(mockFindStaffEmailDomain).not.toHaveBeenCalled();
  });

  it('enforces domain for admin invites', async () => {
    mockFindStaffEmailDomain.mockResolvedValue('sokanacollective.com');
    await assertStaffInviteEmail({
      tenantId: '11111111-1111-4111-8111-111111111111',
      email: 'hello@sokanacollective.com',
      role: 'admin',
    });
    expect(mockFindStaffEmailDomain).toHaveBeenCalled();
  });

  it('rejects admin invite on wrong domain', async () => {
    mockFindStaffEmailDomain.mockResolvedValue('sokanacollective.com');
    await expect(
      assertStaffInviteEmail({
        tenantId: '11111111-1111-4111-8111-111111111111',
        email: 'person@gmail.com',
        role: 'admin',
      })
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
