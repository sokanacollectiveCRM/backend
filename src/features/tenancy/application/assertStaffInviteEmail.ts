import { ValidationError } from '../../../domains/errors';
import {
  emailMatchesStaffDomain,
  staffInviteDomainMessage,
} from '../domain/staffEmailDomain';
import { findStaffEmailDomain } from '../infrastructure/staffEmailDomainRepository';

export type StaffInviteRole = 'admin' | 'doula';

export async function assertStaffInviteEmail(input: {
  tenantId: string | null | undefined;
  email: string;
  /** Domain rule applies to admin staff only (not doulas or clients). */
  role?: StaffInviteRole;
}): Promise<void> {
  if (input.role === 'doula') {
    return;
  }

  if (!input.tenantId) {
    throw new ValidationError(
      'Sign in to an organization before inviting an admin or doula.'
    );
  }

  const domain = await findStaffEmailDomain(input.tenantId);
  if (!domain) {
    throw new ValidationError(
      'This organization has no staff email domain configured.'
    );
  }

  if (!emailMatchesStaffDomain(input.email, domain)) {
    throw new ValidationError(staffInviteDomainMessage(domain));
  }
}
