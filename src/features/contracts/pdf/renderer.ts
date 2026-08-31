import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';

import { nativeContracts } from '../../../config/env';
import { ContractSnapshot } from '../domain/types';
import { toPdfBox, validateFieldManifest } from './coordinates';
import { mergeSnapshotSigningCoordinates } from './initialsPlacement';
import { embedTypedSignatureFont } from './signatureFont';
import {
  AdoptedSignature,
  PdfTemplateField,
  RegisteredPdfTemplate,
  SnapshotFieldSource,
} from './types';

const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/;

function dollars(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function snapshotValue(
  snapshot: ContractSnapshot,
  source: SnapshotFieldSource
): string {
  switch (source) {
    case 'contractId':
      return snapshot.contractId;
    case 'serviceType':
      return snapshot.serviceType;
    case 'client.name':
      return snapshot.client.name;
    case 'client.email':
      return snapshot.client.email;
    case 'createdAt':
      return snapshot.createdAt.slice(0, 10);
    case 'selectedServices.summary':
      return snapshot.selectedServices
        .map((service) => {
          if (service.type === 'flat') {
            return `${service.name}: ${dollars(service.amountCents ?? 0)}`;
          }
          return `${service.name}: ${service.totalHours ?? 0} hrs @ ${dollars(
            service.hourlyRateCents ?? 0
          )}`;
        })
        .join('; ');
    case 'selectedServices.totalHours':
      return (
        snapshot.templateValues?.totalHours ??
        snapshot.selectedServices
          .filter((service) => service.type === 'hourly')
          .reduce((sum, service) => sum + (service.totalHours ?? 0), 0)
          .toString()
      );
    case 'templateValues.hourlyRateCents':
      return dollars(snapshot.templateValues?.hourlyRateCents ?? 0);
    case 'templateValues.overnightFeeCents':
      return dollars(snapshot.templateValues?.overnightFeeCents ?? 0);
    case 'pricing.installmentCents':
      return snapshot.pricing.installmentCents.map(dollars).join(', ');
    default: {
      const key = source.slice('pricing.'.length) as Exclude<
        keyof ContractSnapshot['pricing'],
        'discountRate' | 'installmentCents'
      >;
      return dollars(snapshot.pricing[key]);
    }
  }
}

function fitText(text: string, font: PDFFont, fontSize: number, width: number) {
  const normalized = text.replace(/[\r\n\t]+/g, ' ').trim();
  if (!normalized) return '';
  if (font.widthOfTextAtSize(normalized, fontSize) <= width) return normalized;
  let shortened = normalized;
  while (
    shortened.length > 1 &&
    font.widthOfTextAtSize(`${shortened}…`, fontSize) > width
  ) {
    shortened = shortened.slice(0, -1);
  }
  return `${shortened}…`;
}

function drawTextInField(
  page: PDFPage,
  field: PdfTemplateField,
  text: string,
  font: PDFFont,
  defaultSize = 10,
  coverExisting = false
): void {
  const box = toPdfBox(page, field.coordinates);
  if (coverExisting) {
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      color: rgb(1, 1, 1),
    });
  }
  const size = Math.min(field.fontSize ?? defaultSize, box.height * 0.72);
  const value = fitText(text, font, size, box.width);
  if (!value) return;
  page.drawText(value, {
    x: box.x,
    y: box.y + Math.max((box.height - size) / 2, 0),
    size,
    font,
    color: rgb(0, 0, 0),
    maxWidth: box.width,
  });
}

export async function renderUnsignedPdf(
  canonicalPdf: Buffer,
  registration: RegisteredPdfTemplate,
  snapshot: ContractSnapshot
): Promise<Buffer> {
  if (
    snapshot.templateId !== registration.identifier ||
    snapshot.templateVersion !== registration.version
  ) {
    throw new Error('Contract snapshot does not match the template version');
  }
  const pdf = await PDFDocument.load(canonicalPdf);
  validateFieldManifest(registration.fields, pdf.getPageCount());
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  for (const field of registration.fields) {
    if (field.kind !== 'snapshot_text') continue;
    const value = snapshotValue(snapshot, field.source);
    if (field.required && !value) {
      throw new Error(`Required snapshot field is empty: ${field.id}`);
    }
    drawTextInField(pdf.getPage(field.page - 1), field, value, font, 10, true);
  }
  return Buffer.from(await pdf.save());
}

function decodeDrawnPng(dataUrl: string): Buffer {
  const match = PNG_DATA_URL.exec(dataUrl);
  if (!match) throw new Error('Drawn signature must be a PNG data URL');
  const bytes = Buffer.from(match[1], 'base64');
  if (
    bytes.length === 0 ||
    bytes.length > nativeContracts.drawnSignatureMaxBytes
  ) {
    throw new Error('Drawn signature PNG has an invalid size');
  }
  return bytes;
}

export interface CompletionEvidence {
  evidenceId: string;
  correlationId: string;
  signerName: string;
  serverSignedAt: Date;
  unsignedSha256: string;
}

export async function renderCompletedPdf(
  unsignedPdf: Buffer,
  registration: RegisteredPdfTemplate,
  snapshot: ContractSnapshot,
  adopted: AdoptedSignature,
  evidence: CompletionEvidence
): Promise<Buffer> {
  const initials = adopted.initials.trim();
  if (!initials) throw new Error('Adopted initials are required');
  if (!evidence.signerName.trim()) throw new Error('Signer name is required');
  if (!Number.isFinite(evidence.serverSignedAt.getTime())) {
    throw new Error('Server signing time is invalid');
  }

  const pdf = await PDFDocument.load(unsignedPdf);
  const signingFields = mergeSnapshotSigningCoordinates(
    registration.fields,
    snapshot.fields
  );
  validateFieldManifest(signingFields, pdf.getPageCount());
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const initialsFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const typedSignatureFont = await embedTypedSignatureFont(pdf);
  const acknowledgmentFields = signingFields.filter(
    (field) => field.kind === 'acknowledgment'
  );
  const knownAcknowledgments = new Set(
    acknowledgmentFields.map((field) => field.id)
  );
  const knownSigningFieldIds = new Set(signingFields.map((field) => field.id));
  for (const id of adopted.acknowledgedFieldIds) {
    if (!knownSigningFieldIds.has(id)) {
      throw new Error(`Unknown signing field: ${id}`);
    }
  }
  // Completion payloads include signature/initials/date ids; only acknowledgments
  // are checked and stamped with an X.
  const acknowledgmentIds = new Set(
    adopted.acknowledgedFieldIds.filter((id) => knownAcknowledgments.has(id))
  );
  for (const field of acknowledgmentFields) {
    if (field.required && !acknowledgmentIds.has(field.id)) {
      throw new Error(`Required acknowledgment was not adopted: ${field.id}`);
    }
  }

  const drawnPng =
    adopted.value.type === 'drawn'
      ? await pdf.embedPng(decodeDrawnPng(adopted.value.dataUrl))
      : null;
  const typedText =
    adopted.value.type === 'typed' ? adopted.value.text.trim() : '';
  if (adopted.value.type === 'typed' && !typedText) {
    throw new Error('Typed signature text is required');
  }

  const completedFieldIds: string[] = [];
  for (const field of signingFields) {
    if (field.kind === 'snapshot_text') continue;
    const page = pdf.getPage(field.page - 1);
    if (field.kind === 'signature') {
      if (drawnPng) {
        const box = toPdfBox(page, field.coordinates);
        const scale = Math.min(
          box.width / drawnPng.width,
          box.height / drawnPng.height
        );
        page.drawImage(drawnPng, {
          x: box.x,
          y: box.y,
          width: drawnPng.width * scale,
          height: drawnPng.height * scale,
        });
      } else {
        drawTextInField(page, field, typedText, typedSignatureFont, 28);
      }
      completedFieldIds.push(field.id);
    } else if (field.kind === 'initials') {
      drawTextInField(page, field, initials, initialsFont, 12, true);
      completedFieldIds.push(field.id);
    } else if (field.kind === 'signing_date') {
      drawTextInField(
        page,
        field,
        evidence.serverSignedAt.toISOString().slice(0, 10),
        regular
      );
      completedFieldIds.push(field.id);
    } else if (acknowledgmentIds.has(field.id)) {
      drawTextInField(page, field, 'X', regular, 12);
      completedFieldIds.push(field.id);
    }
  }

  const completionPage = pdf.addPage();
  const { height, width } = completionPage.getSize();
  const signedOn = evidence.serverSignedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const lines = [
    'Certificate of Completion',
    '',
    `This agreement was electronically signed by ${evidence.signerName.trim()}.`,
    `Service: ${snapshot.serviceType}`,
    `Date signed: ${signedOn}`,
    '',
    'A copy of this signed agreement has been emailed to you for your records.',
    'If you have questions, contact Sokana Collective.',
  ];
  lines.forEach((line, index) => {
    if (!line) return;
    const size = index === 0 ? 20 : 11;
    completionPage.drawText(fitText(line, regular, size, width - 96), {
      x: 48,
      y: height - 72 - index * 28,
      size,
      font: regular,
      color: rgb(0, 0, 0),
    });
  });
  return Buffer.from(await pdf.save());
}
