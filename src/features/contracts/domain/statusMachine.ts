import { ContractStatus } from './types';

export const CONTRACT_STATUS_TRANSITIONS: Readonly<
  Record<ContractStatus, readonly ContractStatus[]>
> = {
  draft: ['ready', 'voided'],
  ready: ['draft', 'sent', 'voided'],
  sent: [
    'viewed',
    'partially_signed',
    'signed',
    'declined',
    'expired',
    'voided',
  ],
  viewed: ['partially_signed', 'signed', 'declined', 'expired', 'voided'],
  partially_signed: ['signed', 'declined', 'expired', 'voided'],
  signed: [],
  declined: [],
  expired: [],
  voided: [],
};

export function getAllowedContractStatusTransitions(
  status: ContractStatus
): readonly ContractStatus[] {
  return CONTRACT_STATUS_TRANSITIONS[status];
}

export function canTransitionContractStatus(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  return from === to || CONTRACT_STATUS_TRANSITIONS[from].includes(to);
}

export function assertContractStatusTransition(
  from: ContractStatus,
  to: ContractStatus
): void {
  if (!canTransitionContractStatus(from, to)) {
    throw new Error(`Invalid contract status transition: ${from} -> ${to}`);
  }
}
