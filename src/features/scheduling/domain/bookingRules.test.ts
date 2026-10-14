import { AuthorizationError, ValidationError } from '../../../domains/errors';
import { assertBookingTransition, parseBookingStatus } from './bookingRules';

describe('booking rules', () => {
  it('lets a doula approve, decline, or cancel a pending visit', () => {
    expect(() =>
      assertBookingTransition({
        currentStatus: 'pending',
        nextStatus: 'approved',
        role: 'doula',
      })
    ).not.toThrow();
    expect(() =>
      assertBookingTransition({
        currentStatus: 'pending',
        nextStatus: 'rejected',
        role: 'doula',
      })
    ).not.toThrow();
    expect(() =>
      assertBookingTransition({
        currentStatus: 'pending',
        nextStatus: 'cancelled',
        role: 'doula',
      })
    ).not.toThrow();
  });

  it('lets a client cancel pending or approved only', () => {
    expect(() =>
      assertBookingTransition({
        currentStatus: 'pending',
        nextStatus: 'cancelled',
        role: 'client',
      })
    ).not.toThrow();
    expect(() =>
      assertBookingTransition({
        currentStatus: 'approved',
        nextStatus: 'cancelled',
        role: 'client',
      })
    ).not.toThrow();
    expect(() =>
      assertBookingTransition({
        currentStatus: 'pending',
        nextStatus: 'approved',
        role: 'client',
      })
    ).toThrow(AuthorizationError);
    expect(() =>
      assertBookingTransition({
        currentStatus: 'rejected',
        nextStatus: 'cancelled',
        role: 'client',
      })
    ).toThrow(ValidationError);
  });

  it('lets an admin set any status', () => {
    expect(() =>
      assertBookingTransition({
        currentStatus: 'rejected',
        nextStatus: 'approved',
        role: 'admin',
      })
    ).not.toThrow();
  });

  it('parses booking status', () => {
    expect(parseBookingStatus('Approved')).toBe('approved');
    expect(() => parseBookingStatus('nope')).toThrow(ValidationError);
  });
});
