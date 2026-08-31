import { PDFPage } from 'pdf-lib';

import { NormalizedCoordinates } from '../domain/types';
import { PdfTemplateField } from './types';

export interface PdfBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function validateNormalizedCoordinates(
  coordinates: NormalizedCoordinates,
  label = 'coordinates'
): void {
  const values = [
    coordinates.x,
    coordinates.y,
    coordinates.width,
    coordinates.height,
  ];
  if (!values.every(Number.isFinite)) {
    throw new Error(`${label} must contain finite numbers`);
  }
  if (
    coordinates.x < 0 ||
    coordinates.y < 0 ||
    coordinates.width <= 0 ||
    coordinates.height <= 0 ||
    coordinates.x + coordinates.width > 1 ||
    coordinates.y + coordinates.height > 1
  ) {
    throw new Error(`${label} must fit within normalized page bounds`);
  }
}

/**
 * Manifests use a browser-friendly top-left origin. PDF-lib uses bottom-left.
 */
export function toPdfBox(
  page: Pick<PDFPage, 'getWidth' | 'getHeight'>,
  coordinates: NormalizedCoordinates
): PdfBox {
  validateNormalizedCoordinates(coordinates);
  const pageWidth = page.getWidth();
  const pageHeight = page.getHeight();
  return {
    x: coordinates.x * pageWidth,
    y: (1 - coordinates.y - coordinates.height) * pageHeight,
    width: coordinates.width * pageWidth,
    height: coordinates.height * pageHeight,
  };
}

export function validateFieldManifest(
  fields: readonly PdfTemplateField[],
  pageCount?: number
): void {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error('Template field manifest must be a non-empty array');
  }
  const ids = new Set<string>();
  for (const field of fields) {
    if (!field.id.trim() || ids.has(field.id)) {
      throw new Error(`Template field ID is empty or duplicated: ${field.id}`);
    }
    ids.add(field.id);
    if (!Number.isInteger(field.page) || field.page < 1) {
      throw new Error(`Field ${field.id} page must be a positive integer`);
    }
    if (pageCount !== undefined && field.page > pageCount) {
      throw new Error(
        `Field ${field.id} references page ${field.page}, but PDF has ${pageCount} pages`
      );
    }
    validateNormalizedCoordinates(field.coordinates, `Field ${field.id}`);
    if (
      field.fontSize !== undefined &&
      (!Number.isFinite(field.fontSize) || field.fontSize <= 0)
    ) {
      throw new Error(`Field ${field.id} fontSize must be positive`);
    }
  }
}
