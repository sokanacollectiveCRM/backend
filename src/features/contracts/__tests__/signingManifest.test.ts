import { ContractSnapshot, ContractTemplateField } from '../domain/types';
import { PdfTemplateField } from '../pdf/types';
import { signingManifestFromSnapshot } from '../services/signingManifest';

describe('signingManifestFromSnapshot', () => {
  const snapshotField = (
    overrides: Partial<ContractTemplateField> &
      Pick<ContractTemplateField, 'id'>
  ): ContractTemplateField => ({
    type: 'initials',
    page: 2,
    coordinates: { x: 0.1, y: 0.2, width: 0.05, height: 0.02 },
    required: true,
    ...overrides,
  });

  const snapshot = (
    fields: readonly ContractTemplateField[]
  ): ContractSnapshot => ({
    contractId: 'contract-1',
    templateId: 'labor_support',
    templateVersion: 2,
    serviceType: 'Labor Support Services',
    client: { id: 'client-1', name: 'Client', email: 'client@test' },
    fields,
    selectedServices: [],
    pricing: {
      servicesSubtotalCents: 100,
      discountRate: 0,
      discountCents: 0,
      servicesAfterDiscountCents: 100,
      adminFeeCents: 0,
      totalCents: 100,
      depositCents: 1,
      balanceCents: 99,
      installmentCents: [99],
    },
    createdAt: '2026-08-30T00:00:00.000Z',
  });

  it('maps frozen contract snapshot fields to signing manifest entries', () => {
    const fields = [
      snapshotField({
        id: 'client-initials-1',
        coordinates: {
          x: 272 / 612,
          y: 634 / 792,
          width: 44 / 612,
          height: 18 / 792,
        },
      }),
      snapshotField({
        id: 'client-signature',
        type: 'signature',
        page: 3,
        coordinates: { x: 0.5, y: 0.3, width: 0.2, height: 0.05 },
      }),
    ];

    const manifest = signingManifestFromSnapshot(snapshot(fields));

    expect(manifest).toEqual([
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 2,
        coordinates: fields[0].coordinates,
        required: true,
        label: undefined,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fields[1].coordinates,
        required: true,
        label: undefined,
      },
    ] satisfies PdfTemplateField[]);
  });
});
