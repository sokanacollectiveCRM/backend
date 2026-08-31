import {
  BillingPath,
  isClientDepositRequired,
} from '../../../constants/portalEligibility';
import { isLaborContract } from './classification';
import { ContractSnapshot } from './types';

/** A client payment schedule exists only for a positive self-pay labor deposit. */
export function shouldCreateClientPaymentSchedule(
  snapshot: ContractSnapshot,
  billingPath: BillingPath
): boolean {
  return (
    isClientDepositRequired(billingPath) &&
    isLaborContract(snapshot.serviceType) &&
    snapshot.pricing.depositCents > 0 &&
    snapshot.pricing.totalCents > snapshot.pricing.depositCents
  );
}
