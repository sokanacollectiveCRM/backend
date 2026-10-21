import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export async function notificationTickAuthorized(
  authorization: string | undefined
): Promise<boolean> {
  const audience = process.env.NOTIFICATION_TICK_AUDIENCE?.trim();
  const expectedEmail = process.env.NOTIFICATION_TICK_EMAIL?.trim();
  if (!audience || !expectedEmail) return false;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match?.[1]) return false;
  try {
    const ticket = await client.verifyIdToken({
      idToken: match[1],
      audience,
    });
    const payload = ticket.getPayload();
    return payload?.email === expectedEmail && payload.email_verified !== false;
  } catch {
    return false;
  }
}
