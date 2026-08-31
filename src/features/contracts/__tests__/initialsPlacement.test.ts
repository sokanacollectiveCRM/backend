import {
  ContractPricingSnapshot,
  NormalizedCoordinates,
} from '../domain/types';
import {
  buildSigningFieldsFromTemplate,
  measureDollarTextWidth,
  mergeSnapshotSigningCoordinates,
  placeInitialsAfterAmount,
} from '../pdf/initialsPlacement';
import { PdfTemplateField } from '../pdf/types';

const PAGE_WIDTH = 612;

function fieldById(
  fields: readonly { id: string; coordinates: NormalizedCoordinates }[],
  id: string
) {
  const field = fields.find((item) => item.id === id);
  if (!field) throw new Error(`Missing field ${id}`);
  return field;
}

function topLeftBox(coordinates: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    x: coordinates.x * PAGE_WIDTH,
    y: coordinates.y * 792,
    width: coordinates.width * PAGE_WIDTH,
    height: coordinates.height * 792,
  };
}

describe('initials placement', () => {
  const laborTemplateFields: PdfTemplateField[] = [
    {
      id: 'total',
      kind: 'snapshot_text',
      page: 2,
      source: 'pricing.totalCents',
      coordinates: {
        x: 149 / PAGE_WIDTH,
        y: 634 / 792,
        width: 120 / PAGE_WIDTH,
        height: 22 / 792,
      },
      required: true,
    },
    {
      id: 'deposit',
      kind: 'snapshot_text',
      page: 2,
      source: 'pricing.depositCents',
      coordinates: {
        x: 174 / PAGE_WIDTH,
        y: 658 / 792,
        width: 130 / PAGE_WIDTH,
        height: 22 / 792,
      },
      required: true,
    },
    {
      id: 'balance',
      kind: 'snapshot_text',
      page: 2,
      source: 'pricing.balanceCents',
      coordinates: {
        x: 148 / PAGE_WIDTH,
        y: 674 / 792,
        width: 130 / PAGE_WIDTH,
        height: 22 / 792,
      },
      required: true,
    },
    {
      id: 'client-initials-1',
      kind: 'initials',
      page: 2,
      coordinates: {
        x: 272 / PAGE_WIDTH,
        y: 634 / 792,
        width: 24 / PAGE_WIDTH,
        height: 14 / 792,
      },
      required: true,
    },
    {
      id: 'client-initials-2',
      kind: 'initials',
      page: 2,
      coordinates: {
        x: 307 / PAGE_WIDTH,
        y: 658 / 792,
        width: 24 / PAGE_WIDTH,
        height: 14 / 792,
      },
      required: true,
    },
    {
      id: 'client-initials-3',
      kind: 'initials',
      page: 2,
      coordinates: {
        x: 281 / PAGE_WIDTH,
        y: 674 / 792,
        width: 24 / PAGE_WIDTH,
        height: 14 / 792,
      },
      required: true,
    },
  ];

  const pricing: ContractPricingSnapshot = {
    servicesSubtotalCents: 200_000,
    discountRate: 0,
    discountCents: 0,
    servicesAfterDiscountCents: 200_000,
    adminFeeCents: 0,
    totalCents: 200_000,
    depositCents: 20_000,
    balanceCents: 180_000,
    installmentCents: [180_000],
  };

  it('measures rendered dollar widths used by snapshot text', () => {
    expect(measureDollarTextWidth(200_000)).toBeCloseTo(44.5, 1);
    expect(measureDollarTextWidth(20_000)).toBeCloseTo(36.1, 1);
    expect(measureDollarTextWidth(180_000)).toBeCloseTo(44.5, 1);
  });

  it('places initials immediately after the rendered amount with a small gap', () => {
    const total = laborTemplateFields.find((field) => field.id === 'total')!;
    const initials = laborTemplateFields.find(
      (field) => field.id === 'client-initials-1'
    )!;

    const placed = placeInitialsAfterAmount(
      total,
      initials,
      pricing.totalCents
    );
    expect(Math.round(topLeftBox(placed).x)).toBe(197);
  });

  it('builds labor signing fields that avoid both amounts and trailing text', () => {
    const fields = buildSigningFieldsFromTemplate(
      'labor_support',
      laborTemplateFields,
      pricing
    );

    const pairs = [
      ['total', 'client-initials-1'],
      ['deposit', 'client-initials-2'],
      ['balance', 'client-initials-3'],
    ] as const;

    for (const [amountId, initialsId] of pairs) {
      const amount = fieldById(laborTemplateFields, amountId).coordinates;
      const initials = fieldById(fields, initialsId).coordinates;
      const amountWidth = measureDollarTextWidth(
        pricing[
          amountId === 'total'
            ? 'totalCents'
            : amountId === 'deposit'
              ? 'depositCents'
              : 'balanceCents'
        ]
      );
      const amountEnd = amount.x * PAGE_WIDTH + amountWidth;
      const initialsStart = initials.x * PAGE_WIDTH;
      const initialsEnd = initialsStart + initials.width * PAGE_WIDTH;

      expect(initialsStart).toBeGreaterThanOrEqual(amountEnd + 4);
      expect(initialsEnd).toBeLessThan(250);
    }
  });

  it('merges snapshot coordinates into template fields for completion stamping', () => {
    const snapshotFields = buildSigningFieldsFromTemplate(
      'labor_support',
      laborTemplateFields,
      pricing
    );
    const merged = mergeSnapshotSigningCoordinates(
      laborTemplateFields,
      snapshotFields
    );

    expect(fieldById(merged, 'client-initials-2').coordinates).toEqual(
      fieldById(snapshotFields, 'client-initials-2').coordinates
    );
    expect(fieldById(merged, 'total').coordinates).toEqual(
      fieldById(laborTemplateFields, 'total').coordinates
    );
  });
});
