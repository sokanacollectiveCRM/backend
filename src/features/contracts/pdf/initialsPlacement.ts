import {
  ContractPricingSnapshot,
  ContractTemplateField,
  NormalizedCoordinates,
} from '../domain/types';
import { PdfTemplateField } from './types';

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const SNAPSHOT_FONT_SIZE = 10;
const INITIALS_GAP_POINTS = 4;

const HELVETICA_10_CHAR_WIDTH: Record<string, number> = {
  $: 5.56,
  '0': 5.56,
  '1': 5.56,
  '2': 5.56,
  '3': 5.56,
  '4': 5.56,
  '5': 5.56,
  '6': 5.56,
  '7': 5.56,
  '8': 5.56,
  '9': 5.56,
  ',': 2.78,
  '.': 2.78,
};

const LABOR_INITIALS_BINDINGS = [
  {
    initialsId: 'client-initials-1',
    amountFieldId: 'total',
    pricingKey: 'totalCents' as const,
  },
  {
    initialsId: 'client-initials-2',
    amountFieldId: 'deposit',
    pricingKey: 'depositCents' as const,
  },
  {
    initialsId: 'client-initials-3',
    amountFieldId: 'balance',
    pricingKey: 'balanceCents' as const,
  },
] as const;

function formatDollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

export function measureDollarTextWidth(cents: number): number {
  const text = formatDollars(cents);
  return [...text].reduce(
    (sum, character) => sum + (HELVETICA_10_CHAR_WIDTH[character] ?? 5.56),
    0
  );
}

function toTopLeftPoints(coordinates: NormalizedCoordinates) {
  return {
    x: coordinates.x * PAGE_WIDTH,
    y: coordinates.y * PAGE_HEIGHT,
    width: coordinates.width * PAGE_WIDTH,
    height: coordinates.height * PAGE_HEIGHT,
  };
}

function fromTopLeftPoints(
  x: number,
  y: number,
  width: number,
  height: number
): NormalizedCoordinates {
  return {
    x: x / PAGE_WIDTH,
    y: y / PAGE_HEIGHT,
    width: width / PAGE_WIDTH,
    height: height / PAGE_HEIGHT,
  };
}

export function placeInitialsAfterAmount(
  amountField: Pick<PdfTemplateField, 'coordinates'>,
  initialsField: Pick<PdfTemplateField, 'coordinates'>,
  amountCents: number,
  gapPoints = INITIALS_GAP_POINTS
): NormalizedCoordinates {
  const amountBox = toTopLeftPoints(amountField.coordinates);
  const initialsBox = toTopLeftPoints(initialsField.coordinates);
  const amountWidth = measureDollarTextWidth(amountCents);
  const x = amountBox.x + amountWidth + gapPoints;

  return fromTopLeftPoints(
    x,
    amountBox.y,
    initialsBox.width,
    initialsBox.height
  );
}

export function buildSigningFieldsFromTemplate(
  templateIdentifier: string,
  templateFields: readonly PdfTemplateField[],
  pricing: ContractPricingSnapshot
): ContractTemplateField[] {
  const signingFields = templateFields
    .filter((field) => field.kind !== 'snapshot_text')
    .map(
      (field): ContractTemplateField => ({
        id: field.id,
        type: field.kind,
        page: field.page,
        coordinates: field.coordinates,
        label: field.label,
        required: field.required,
      })
    );

  if (templateIdentifier !== 'labor_support') {
    return signingFields;
  }

  const amountFields = new Map(
    templateFields
      .filter((field) => field.kind === 'snapshot_text')
      .map((field) => [field.id, field])
  );
  const initialsById = new Map(
    signingFields
      .filter((field) => field.type === 'initials')
      .map((field) => [field.id, field])
  );

  for (const binding of LABOR_INITIALS_BINDINGS) {
    const amountField = amountFields.get(binding.amountFieldId);
    const initialsField = initialsById.get(binding.initialsId);
    if (!amountField || !initialsField) continue;

    initialsField.coordinates = placeInitialsAfterAmount(
      amountField,
      initialsField,
      pricing[binding.pricingKey]
    );
  }

  return signingFields;
}

export function mergeSnapshotSigningCoordinates(
  registrationFields: readonly PdfTemplateField[],
  snapshotFields: readonly ContractTemplateField[]
): PdfTemplateField[] {
  const snapshotCoordinates = new Map(
    snapshotFields.map((field) => [field.id, field.coordinates])
  );

  return registrationFields.map((field) => {
    if (field.kind === 'snapshot_text') return field;
    const coordinates = snapshotCoordinates.get(field.id);
    return coordinates ? { ...field, coordinates } : field;
  });
}
