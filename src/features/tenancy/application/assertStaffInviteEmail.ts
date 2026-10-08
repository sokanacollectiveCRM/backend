import { ValidationError } from '../../../domains/errors';
import {
  emailMatchesStaffDomain,
  staffInviteDomainMessage,
} from '../domain/staffEmailDomain';
import { findStaffEmailDomain } from '../infrastructure/staffEmailDomainRepository';

export async function assertStaffInviteEmail(input: {
  tenantId: string | null | undefined;
  email: string;
}): Promise<void> {
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
