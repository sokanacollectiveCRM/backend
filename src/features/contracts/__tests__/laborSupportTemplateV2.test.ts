import {
  boxesOverlap,
  horizontalGap,
  renderFieldPreviewPdf,
  topLeftBoxFromPoints,
} from '../pdf/fieldPreview';
import { PdfTemplateField } from '../pdf/types';

const {
  NATIVE_TEMPLATE_SEEDS,
}: {
  NATIVE_TEMPLATE_SEEDS: readonly {
    identifier: string;
    version: number;
    pdfFile: string;
    fields: readonly {
      id: string;
      kind: string;
      page: number;
      coordinates: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }[];
  }[];
} = require('../../../../scripts/seed-native-contract-templates');

function fieldById(seed: (typeof NATIVE_TEMPLATE_SEEDS)[number], id: string) {
  const field = seed.fields.find((item) => item.id === id);
  if (!field) throw new Error(`Missing field ${id}`);
  return field;
}

describe('labor_support template v2 coordinates', () => {
  const v1 = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 1
  )!;
  const v2 = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 2
  )!;

  it('keeps financial snapshot fields unchanged between v1 and v2', () => {
    for (const id of ['total', 'deposit', 'balance']) {
      expect(fieldById(v2, id).coordinates).toEqual(
        fieldById(v1, id).coordinates
      );
    }
  });

  it('moves labor initials beside financial amounts without overlapping snapshot boxes', () => {
    const financialPairs = [
      ['total', 'client-initials-1'],
      ['deposit', 'client-initials-2'],
      ['balance', 'client-initials-3'],
    ] as const;

    for (const [financialId, initialsId] of financialPairs) {
      const financial = fieldById(v2, financialId).coordinates;
      const initials = fieldById(v2, initialsId).coordinates;
      expect(boxesOverlap(financial, initials)).toBe(false);
      expect(horizontalGap(financial, initials)).toBeGreaterThan(0);
      expect(initials.y).toBeCloseTo(financial.y, 3);
    }
  });

  it('keeps v2 initials left of continuation text on wrapped financial lines', () => {
    expect(fieldById(v2, 'client-initials-1').coordinates.x).toBeLessThan(
      300 / 612
    );
    expect(fieldById(v2, 'client-initials-2').coordinates.x).toBeLessThan(
      338 / 612
    );

    const balance = fieldById(v2, 'balance').coordinates;
    const initials3 = fieldById(v2, 'client-initials-3').coordinates;
    expect(initials3.x).toBeGreaterThan(balance.x + balance.width);
    expect(initials3.x + initials3.width).toBeLessThan(338 / 612);
  });

  it('documents that v1 initials were adjacent but not overlapping in manifest space', () => {
    const total = fieldById(v1, 'total').coordinates;
    const initials = fieldById(v1, 'client-initials-1').coordinates;
    expect(boxesOverlap(total, initials)).toBe(false);
    expect(horizontalGap(total, initials)).toBeLessThan(0.02);
  });
});

describe('labor_support template v3 coordinates', () => {
  const v3 = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 3
  )!;

  it('places compact initial boxes immediately after rendered dollar values', () => {
    expect(fieldById(v3, 'client-initials-1').coordinates).toEqual(
      topLeftBoxFromPoints(184, 634, 28, 16)
    );
    expect(fieldById(v3, 'client-initials-2').coordinates).toEqual(
      topLeftBoxFromPoints(209, 658, 28, 16)
    );
    expect(fieldById(v3, 'client-initials-3').coordinates).toEqual(
      topLeftBoxFromPoints(183, 674, 28, 16)
    );
  });
});

describe('labor_support template v4 coordinates', () => {
  const v4 = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 4
  )!;

  it('closes the remaining amount gap and restores the closer date position', () => {
    expect(fieldById(v4, 'client-initials-1').coordinates).toEqual(
      topLeftBoxFromPoints(174, 634, 24, 14)
    );
    expect(fieldById(v4, 'client-initials-2').coordinates).toEqual(
      topLeftBoxFromPoints(199, 658, 24, 14)
    );
    expect(fieldById(v4, 'client-initials-3').coordinates).toEqual(
      topLeftBoxFromPoints(173, 674, 24, 14)
    );
    expect(fieldById(v4, 'client-signing-date').coordinates).toEqual(
      topLeftBoxFromPoints(105, 296, 120, 28)
    );
  });
});

describe('labor_support template v5 coordinates', () => {
  const v4 = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 4
  )!;
  const v5 = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 5
  )!;

  it('places every initials box after its financial value without overlap', () => {
    const financialPairs = [
      ['total', 'client-initials-1'],
      ['deposit', 'client-initials-2'],
      ['balance', 'client-initials-3'],
    ] as const;

    for (const [financialId, initialsId] of financialPairs) {
      const financial = fieldById(v5, financialId).coordinates;
      const initials = fieldById(v5, initialsId).coordinates;
      expect(boxesOverlap(financial, initials)).toBe(false);
      expect(horizontalGap(financial, initials)).toBeGreaterThan(0);
      expect(initials.y).toBeCloseTo(financial.y, 3);
    }
  });

  it('keeps the compact initials boxes and signing-date placement from v4', () => {
    for (const id of [
      'client-initials-1',
      'client-initials-2',
      'client-initials-3',
    ]) {
      const initials = fieldById(v5, id).coordinates;
      expect(initials.width).toBeCloseTo(24 / 612, 5);
      expect(initials.height).toBeCloseTo(14 / 792, 5);
    }
    expect(fieldById(v5, 'client-signing-date').coordinates).toEqual(
      fieldById(v4, 'client-signing-date').coordinates
    );
  });
});

describe('labor_support field preview rendering', () => {
  it('draws v2 manifest boxes onto a synthetic PDF for visual inspection', async () => {
    const { PDFDocument } = require('pdf-lib');
    const pdf = await PDFDocument.create();
    for (let index = 0; index < 3; index += 1) pdf.addPage([612, 792]);
    const bytes = Buffer.from(await pdf.save());
    const v2 = NATIVE_TEMPLATE_SEEDS.find(
      (seed) => seed.identifier === 'labor_support' && seed.version === 2
    )!;

    const preview = await renderFieldPreviewPdf(
      bytes,
      v2.fields as PdfTemplateField[]
    );
    expect(preview.byteLength).toBeGreaterThan(bytes.byteLength);
  });
});

describe('top-left coordinate helpers', () => {
  it('matches seed normalization for labor initials v2', () => {
    const box = topLeftBoxFromPoints(272, 634, 44, 18);
    expect(box.x).toBeCloseTo(272 / 612, 5);
    expect(box.y).toBeCloseTo(634 / 792, 5);
    expect(box.width).toBeCloseTo(44 / 612, 5);
    expect(box.height).toBeCloseTo(18 / 792, 5);
  });
});
