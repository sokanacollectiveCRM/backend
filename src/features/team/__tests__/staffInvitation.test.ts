import { invitationCanBeAccepted } from '../domain/staffInvitation';

describe('staff invitation acceptance', () => {
  const now = new Date('2026-10-06T12:00:00.000Z');

  it('accepts a pending invitation that has not expired', () => {
    expect(
      invitationCanBeAccepted(
        'pending',
        new Date('2026-10-07T12:00:00.000Z'),
        now
      )
    ).toBe(true);
  });

  it('rejects an accepted or expired invitation', () => {
    expect(
      invitationCanBeAccepted(
        'accepted',
        new Date('2026-10-07T12:00:00.000Z'),
        now
      )
    ).toBe(false);
    expect(
      invitationCanBeAccepted(
        'pending',
        new Date('2026-10-06T11:00:00.000Z'),
        now
      )
    ).toBe(false);
  });
});
