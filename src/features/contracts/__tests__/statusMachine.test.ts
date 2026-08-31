import { classifyContractTemplate } from '../domain/classification';
import {
  assertContractStatusTransition,
  canTransitionContractStatus,
  getAllowedContractStatusTransitions,
} from '../domain/statusMachine';

describe('contract status machine', () => {
  it('allows the signing lifecycle and idempotent updates', () => {
    expect(canTransitionContractStatus('draft', 'ready')).toBe(true);
    expect(canTransitionContractStatus('ready', 'sent')).toBe(true);
    expect(canTransitionContractStatus('sent', 'viewed')).toBe(true);
    expect(canTransitionContractStatus('viewed', 'partially_signed')).toBe(
      true
    );
    expect(canTransitionContractStatus('partially_signed', 'signed')).toBe(
      true
    );
    expect(canTransitionContractStatus('sent', 'sent')).toBe(true);
  });

  it('prevents transitions out of terminal statuses', () => {
    for (const status of ['signed', 'declined', 'expired', 'voided'] as const) {
      expect(getAllowedContractStatusTransitions(status)).toEqual([]);
      expect(() => assertContractStatusTransition(status, 'sent')).toThrow(
        `Invalid contract status transition: ${status} -> sent`
      );
    }
  });
});

describe('contract template classification', () => {
  it.each([
    ['Labor Support Services', 'labor'],
    ['combined labor and postpartum care', 'labor'],
    ['LABOR', 'labor'],
    ['Postpartum Doula Services', 'postpartum'],
    [undefined, 'postpartum'],
  ])('classifies %p as %s', (serviceType, expected) => {
    expect(classifyContractTemplate(serviceType)).toBe(expected);
  });
});
