import { buildStaffPasswordSetupUrl } from '../services/identityPlatform/staffPasswordSetup';

const generatePasswordResetLink = jest.fn();
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: () => ({ generatePasswordResetLink }),
}));

describe('staff invitation password setup', () => {
  const originalFrontend = process.env.FRONTEND_URL;
  afterEach(() => {
    if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontend;
    jest.resetAllMocks();
  });
  it('uses an identity-issued one-time code and no editable identity fields', async () => {
    process.env.FRONTEND_URL = 'https://dev.example.com/';
    generatePasswordResetLink.mockResolvedValue(
      'https://identity.example.com/?oobCode=secure-code&mode=resetPassword'
    );
    const link = new URL(await buildStaffPasswordSetupUrl('doula@example.com'));
    expect(generatePasswordResetLink).toHaveBeenCalledWith(
      'doula@example.com',
      { url: 'https://dev.example.com/login' }
    );
    expect(link.origin + link.pathname).toBe('https://dev.example.com/signup');
    expect([...link.searchParams.entries()]).toEqual([
      ['oobCode', 'secure-code'],
    ]);
  });
  it('does not send an insecure signup link if identity returns no code', async () => {
    generatePasswordResetLink.mockResolvedValue(
      'https://identity.example.com/'
    );
    await expect(
      buildStaffPasswordSetupUrl('doula@example.com')
    ).rejects.toThrow('secure invitation link');
  });
});
