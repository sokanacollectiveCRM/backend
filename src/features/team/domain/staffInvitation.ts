export function invitationCanBeAccepted(
  status: string,
  expiresAt: Date,
  now: Date
): boolean {
  return status === 'pending' && expiresAt.getTime() > now.getTime();
}
