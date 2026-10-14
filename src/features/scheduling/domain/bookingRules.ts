import { AuthorizationError, ValidationError } from '../../../domains/errors';
import type { BookingStatus } from './types';

export type SchedulingActorRole = 'admin' | 'doula' | 'client';

export function parseBookingStatus(value: unknown): BookingStatus {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  if (
    normalized === 'pending' ||
    normalized === 'approved' ||
    normalized === 'rejected' ||
    normalized === 'cancelled'
  ) {
    return normalized;
  }
  throw new ValidationError(
    'status must be pending, approved, rejected, or cancelled'
  );
}

export function assertBookingTransition(input: {
  currentStatus: BookingStatus;
  nextStatus: BookingStatus;
  role: SchedulingActorRole;
}): void {
  const { currentStatus, nextStatus, role } = input;
  if (currentStatus === nextStatus) return;

  if (role === 'admin') return;

  if (role === 'client') {
    if (nextStatus !== 'cancelled') {
      throw new AuthorizationError('Clients can only cancel their own visits');
    }
    if (currentStatus !== 'pending' && currentStatus !== 'approved') {
      throw new ValidationError(
        'Only pending or approved visits can be cancelled'
      );
    }
    return;
  }

  // Assigned doula: approve, decline (rejected), or cancel own.
  const doulaAllowed =
    (currentStatus === 'pending' &&
      (nextStatus === 'approved' ||
        nextStatus === 'rejected' ||
        nextStatus === 'cancelled')) ||
    (currentStatus === 'approved' && nextStatus === 'cancelled');

  if (!doulaAllowed) {
    throw new ValidationError(
      `Cannot change a ${currentStatus} visit to ${nextStatus}`
    );
  }
}

export function normalizeNotes(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}
