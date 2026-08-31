import { PDFDocument } from 'pdf-lib';

import { ContractSnapshot } from '../domain/types';
import {
  NativeContractPdfService,
  PdfObjectStorage,
  PdfTemplateRepository,
  RegisteredPdfTemplate,
  sha256,
  templateObjectPath,
  validateNormalizedCoordinates,
} from '../pdf';

async function blankPdf(pageCount = 1): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([612, 792]);
  }
  return Buffer.from(await pdf.save());
}

const box = { x: 0.1, y: 0.1, width: 0.25, height: 0.04 };

function snapshot(): ContractSnapshot {
  return {
    contractId: 'contract-1',
    templateId: 'labor_support',
    templateVersion: 1,
    serviceType: 'Labor Support',
    client: {
      id: 'client-1',
      name: 'Test Client',
      email: 'client@example.test',
    },
    fields: [],
    selectedServices: [
      { id: 'service-1', name: 'Labor', type: 'flat', amountCents: 100_00 },
    ],
    pricing: {
      servicesSubtotalCents: 100_00,
      discountRate: 0,
      discountCents: 0,
      servicesAfterDiscountCents: 100_00,
      adminFeeCents: 0,
      totalCents: 100_00,
      depositCents: 20_00,
      balanceCents: 80_00,
      installmentCents: [80_00],
    },
    createdAt: '2026-08-29T10:00:00.000Z',
  };
}

async function fixture() {
  const canonical = await blankPdf();
  const canonicalHash = sha256(canonical);
  const registration: RegisteredPdfTemplate = {
    identifier: 'labor_support',
    version: 1,
    objectPath: templateObjectPath('labor_support', 1, canonicalHash),
    sha256: canonicalHash,
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 1,
        coordinates: box,
        required: true,
      },
      {
        id: 'signature',
        kind: 'signature',
        page: 1,
        coordinates: { ...box, y: 0.6 },
        required: true,
      },
      {
        id: 'initials-one',
        kind: 'initials',
        page: 1,
        coordinates: { ...box, y: 0.7, width: 0.1 },
        required: true,
      },
      {
        id: 'initials-two',
        kind: 'initials',
        page: 1,
        coordinates: { ...box, x: 0.5, y: 0.7, width: 0.1 },
        required: true,
      },
      {
        id: 'date',
        kind: 'signing_date',
        page: 1,
        coordinates: { ...box, y: 0.8 },
        required: true,
      },
      {
        id: 'ack',
        kind: 'acknowledgment',
        page: 1,
        coordinates: { ...box, x: 0.8, y: 0.8, width: 0.03 },
        required: true,
      },
    ],
  };
  const templates: PdfTemplateRepository = {
    getRegisteredTemplate: jest.fn().mockResolvedValue(registration),
  };
  const uploads: Array<{ path: string; bytes: Buffer }> = [];
  const storage: PdfObjectStorage = {
    download: jest.fn().mockResolvedValue(canonical),
    upload: jest.fn(async (path, bytes) => {
      uploads.push({ path, bytes });
      return { generation: '42', size: bytes.length };
    }),
  };
  return { canonical, registration, templates, storage, uploads };
}

describe('native contract PDF generation', () => {
  it('validates normalized coordinates and page bounds', () => {
    expect(() =>
      validateNormalizedCoordinates({
        x: 0.9,
        y: 0.1,
        width: 0.2,
        height: 0.1,
      })
    ).toThrow('normalized page bounds');
  });

  it('generates an unsigned PDF from an exact registered canonical hash', async () => {
    const { templates, storage, uploads } = await fixture();
    const service = new NativeContractPdfService({ templates, storage });

    const result = await service.generateUnsigned(snapshot());

    expect(result).toEqual(
      expect.objectContaining({
        generation: '42',
        reused: false,
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
    expect(result.path).toContain(
      `contracts/contract-1/unsigned/${result.sha256}.pdf`
    );
    expect(uploads).toHaveLength(1);
    expect(sha256(uploads[0].bytes)).toBe(result.sha256);
  });

  it('rejects canonical bytes that do not match the registry hash', async () => {
    const { registration, templates, storage } = await fixture();
    (registration as { sha256: string }).sha256 = '0'.repeat(64);
    registration.objectPath = templateObjectPath(
      registration.identifier,
      registration.version,
      registration.sha256
    );
    const service = new NativeContractPdfService({ templates, storage });

    await expect(service.generateUnsigned(snapshot())).rejects.toThrow(
      'Canonical template hash mismatch'
    );
  });

  it('uses adopted values and server time, renders all manifest fields, and adds evidence', async () => {
    const { templates, storage, uploads } = await fixture();
    const now = new Date('2026-08-29T15:16:17.000Z');
    const service = new NativeContractPdfService({
      templates,
      storage,
      now: () => now,
    });
    await service.generateUnsigned(snapshot());
    const unsigned = uploads[0].bytes;

    const result = await service.complete({
      snapshot: snapshot(),
      unsignedPdf: unsigned,
      expectedUnsignedSha256: sha256(unsigned),
      adoptedSignature: {
        value: { type: 'typed', text: 'Test Client' },
        initials: 'TC',
        acknowledgedFieldIds: ['ack'],
      },
      signerName: 'Test Client',
      evidenceId: 'evidence-1',
      correlationId: 'correlation-1',
    });

    const completed = uploads[1].bytes;
    const pdf = await PDFDocument.load(completed);
    expect(pdf.getPageCount()).toBe(2);
    expect(result.path).toContain(
      `contracts/contract-1/completed/${result.sha256}.pdf`
    );
    expect((storage.upload as jest.Mock).mock.calls[1][2]).toEqual(
      expect.objectContaining({
        serverSignedAt: now.toISOString(),
        evidenceId: 'evidence-1',
      })
    );
  });

  it('accepts completion payloads that include every completed signing field id', async () => {
    const { templates, storage, uploads } = await fixture();
    const service = new NativeContractPdfService({ templates, storage });
    await service.generateUnsigned(snapshot());
    const unsigned = uploads[0].bytes;

    await expect(
      service.complete({
        snapshot: snapshot(),
        unsignedPdf: unsigned,
        expectedUnsignedSha256: sha256(unsigned),
        adoptedSignature: {
          value: { type: 'typed', text: 'Test Client' },
          initials: 'TC',
          acknowledgedFieldIds: [
            'signature',
            'initials-one',
            'initials-two',
            'date',
            'ack',
          ],
        },
        signerName: 'Test Client',
        evidenceId: 'evidence-1',
        correlationId: 'correlation-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
  });

  it('requires every required acknowledgment', async () => {
    const { templates, storage, uploads } = await fixture();
    const service = new NativeContractPdfService({ templates, storage });
    await service.generateUnsigned(snapshot());
    const unsigned = uploads[0].bytes;

    await expect(
      service.complete({
        snapshot: snapshot(),
        unsignedPdf: unsigned,
        expectedUnsignedSha256: sha256(unsigned),
        adoptedSignature: {
          value: { type: 'typed', text: 'Test Client' },
          initials: 'TC',
          acknowledgedFieldIds: [],
        },
        signerName: 'Test Client',
        evidenceId: 'evidence-1',
        correlationId: 'correlation-1',
      })
    ).rejects.toThrow('Required acknowledgment was not adopted');
  });

  it('embeds an adopted drawn PNG without accepting placement data', async () => {
    const { templates, storage, uploads } = await fixture();
    const service = new NativeContractPdfService({
      templates,
      storage,
      now: () => new Date('2026-08-29T15:16:17.000Z'),
    });
    await service.generateUnsigned(snapshot());
    const unsigned = uploads[0].bytes;
    const onePixelPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    await expect(
      service.complete({
        snapshot: snapshot(),
        unsignedPdf: unsigned,
        expectedUnsignedSha256: sha256(unsigned),
        adoptedSignature: {
          value: { type: 'drawn', dataUrl: onePixelPng },
          initials: 'TC',
          acknowledgedFieldIds: ['ack'],
        },
        signerName: 'Test Client',
        evidenceId: 'evidence-1',
        correlationId: 'correlation-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })
    );
  });

  it('reuses a repository artifact with the same rendered hash', async () => {
    const { templates, storage, uploads } = await fixture();
    const artifacts = {
      findByHash: jest
        .fn()
        .mockImplementation(
          async (
            _contractId: string,
            kind: 'unsigned' | 'completed',
            hash: string
          ) =>
            kind === 'completed'
              ? {
                  path: `contracts/contract-1/completed/${hash}.pdf`,
                  sha256: hash,
                  generation: '77',
                }
              : null
        ),
    };
    const service = new NativeContractPdfService({
      templates,
      storage,
      artifacts,
      now: () => new Date('2026-08-29T15:16:17.000Z'),
    });
    await service.generateUnsigned(snapshot());
    const unsigned = uploads[0].bytes;
    const uploadCount = (storage.upload as jest.Mock).mock.calls.length;

    const result = await service.complete({
      snapshot: snapshot(),
      unsignedPdf: unsigned,
      expectedUnsignedSha256: sha256(unsigned),
      adoptedSignature: {
        value: { type: 'typed', text: 'Test Client' },
        initials: 'TC',
        acknowledgedFieldIds: ['ack'],
      },
      signerName: 'Test Client',
      evidenceId: 'evidence-1',
      correlationId: 'correlation-1',
    });

    expect(result).toEqual(
      expect.objectContaining({ generation: '77', reused: true })
    );
    expect((storage.upload as jest.Mock).mock.calls).toHaveLength(uploadCount);
  });
});
