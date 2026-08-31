import { PDFDocument } from 'pdf-lib';

import {
  GCS_PREFIX,
  downloadObject,
  objectPath,
  uploadObjectWithMetadata,
} from '../../../services/gcs/documentStorage';
import { validateFieldManifest } from './coordinates';
import { assertSha256, verifySha256 } from './hash';
import {
  LoadedPdfTemplate,
  PdfObjectStorage,
  PdfTemplateRepository,
} from './types';

const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export const gcsPdfObjectStorage: PdfObjectStorage = {
  download: downloadObject,
  upload: (path, bytes, metadata) =>
    uploadObjectWithMetadata(path, bytes, 'application/pdf', {
      upsert: false,
      metadata,
    }),
};

export function safePathSegment(value: string, label: string): string {
  if (!SAFE_SEGMENT.test(value)) {
    throw new Error(`${label} contains unsupported path characters`);
  }
  return value;
}

export function templateObjectPath(
  identifier: string,
  version: number,
  hash: string
): string {
  safePathSegment(identifier, 'Template identifier');
  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Template version must be a positive integer');
  }
  assertSha256(hash, 'Template hash');
  return objectPath(
    GCS_PREFIX.contractTemplates,
    `${identifier}/v${version}/${hash}.pdf`
  );
}

export function artifactObjectPath(
  contractId: string,
  kind: 'unsigned' | 'completed',
  hash: string
): string {
  safePathSegment(contractId, 'Contract ID');
  assertSha256(hash, 'Artifact hash');
  return objectPath(GCS_PREFIX.contracts, `${contractId}/${kind}/${hash}.pdf`);
}

export async function loadRegisteredPdfTemplate(
  repository: PdfTemplateRepository,
  storage: PdfObjectStorage,
  identifier: string,
  version?: number
): Promise<LoadedPdfTemplate> {
  const registration = await repository.getRegisteredTemplate(
    identifier,
    version
  );
  if (!registration) {
    throw new Error(
      `Registered PDF template not found: ${identifier}${version ? ` v${version}` : ''}`
    );
  }
  if (
    registration.identifier !== identifier ||
    (version !== undefined && registration.version !== version)
  ) {
    throw new Error(
      'Template repository returned a different template version'
    );
  }
  assertSha256(registration.sha256, 'Registered template hash');
  const expectedPath = templateObjectPath(
    registration.identifier,
    registration.version,
    registration.sha256
  );
  if (registration.objectPath !== expectedPath) {
    throw new Error('Registered template path is not canonical');
  }

  const bytes = await storage.download(registration.objectPath);
  verifySha256(bytes, registration.sha256, 'Canonical template');
  const pdf = await PDFDocument.load(bytes);
  validateFieldManifest(registration.fields, pdf.getPageCount());
  return { registration, bytes };
}
