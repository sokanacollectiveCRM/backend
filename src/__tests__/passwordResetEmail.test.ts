import { sendPasswordResetEmailIfAccountExists } from '../features/auth/application/passwordResetEmail';
import { NodemailerService } from '../services/emailService';
import { getFirebaseAuth } from '../services/identityPlatform/firebaseAdmin';

const generatePasswordResetLink = jest.fn();
const sendEmail = jest.fn();
jest.mock('../services/identityPlatform/firebaseAdmin', () => ({
  getFirebaseAuth: jest.fn(),
}));
jest.mock('../services/emailService', () => ({ NodemailerService: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FRONTEND_URL = 'https://dev.example.test/';
  (getFirebaseAuth as jest.Mock).mockReturnValue({ generatePasswordResetLink });
  (NodemailerService as jest.Mock).mockImplementation(() => ({ sendEmail }));
  generatePasswordResetLink.mockResolvedValue(
    'https://example.test/action?mode=resetPassword&oobCode=one-time-code'
  );
});

it('delivers a backend-generated reset link through the Sokana email service', async () => {
  await sendPasswordResetEmailIfAccountExists(' DOULA@example.test ');
  expect(generatePasswordResetLink).toHaveBeenCalledWith('doula@example.test', {
    url: 'https://dev.example.test/login',
  });
  expect(sendEmail).toHaveBeenCalledWith(
    'doula@example.test',
    'Reset your Sokana360 password',
    expect.stringContaining(
      'https://dev.example.test/auth/reset-password?mode=resetPassword&oobCode=one-time-code'
    )
  );
});

it('does not reveal or email a missing account', async () => {
  generatePasswordResetLink.mockRejectedValue({ code: 'auth/user-not-found' });
  await expect(
    sendPasswordResetEmailIfAccountExists('missing@example.test')
  ).resolves.toBeUndefined();
  expect(sendEmail).not.toHaveBeenCalled();
});
