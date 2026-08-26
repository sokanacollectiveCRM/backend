import fs from 'fs';
import path from 'path';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

import currentCoordinates from '../config/pdfCoordinates.json';
import {
  GCS_PREFIX,
  downloadObject,
  objectPath,
} from '../services/gcs/documentStorage';
import { GENERATED_DIR, ensureDir } from './runtimePaths';

interface CoordinatePosition {
  x: number;
  y: number;
  page: number;
  size?: number;
}

interface CoordinateMap {
  [fieldName: string]: CoordinatePosition;
}

interface ContractData {
  [key: string]: any;
}

/**
 * Fill a static PDF template with contract data using pre-defined coordinates.
 * This eliminates DOCX conversion and ensures perfect SignNow field alignment.
 */
export async function fillPdfTemplate(
  templateKey: string,
  contractData: ContractData
): Promise<string> {
  try {
    console.log(`📄 Filling PDF template: ${templateKey}`);
    console.log(`📋 Contract data:`, contractData);

    // 1️⃣ Download the PDF template from GCS
    console.log(`📥 Downloading PDF template from GCS...`);
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await downloadObject(
        objectPath(GCS_PREFIX.contractTemplates, `${templateKey}.pdf`)
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Template ${templateKey}.pdf not found in GCS: ${message}`
      );
    }

    // 2️⃣ Load the PDF and font
    console.log(`🔄 Loading PDF and embedding font...`);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // 3️⃣ Load coordinate map for this template
    const coordinates = currentCoordinates as { [key: string]: CoordinateMap };
    const coords = coordinates[templateKey];
    if (!coords) {
      throw new Error(`No coordinate map found for template: ${templateKey}`);
    }

    console.log(
      `📍 Using coordinate map for ${templateKey}:`,
      Object.keys(coords)
    );

    // 4️⃣ Fill the PDF with provided data
    let fieldsFilled = 0;
    for (const [field, pos] of Object.entries(coords)) {
      const value = contractData[field] ?? '';
      if (value) {
        try {
          const page = pdfDoc.getPage((pos as any).page - 1);
          page.drawText(String(value), {
            x: (pos as any).x,
            y: (pos as any).y,
            size: (pos as any).size ?? 11,
            font,
            color: rgb(0, 0, 0),
          });
          fieldsFilled++;
          console.log(
            `✅ Filled field "${field}" with "${value}" at (${pos.x}, ${pos.y})`
          );
        } catch (fieldError) {
          console.warn(`⚠️ Failed to fill field "${field}":`, fieldError);
        }
      } else {
        console.log(`⏭️ Skipping empty field: ${field}`);
      }
    }

    console.log(`📊 Filled ${fieldsFilled} fields in PDF`);

    // 5️⃣ Save filled contract
    const timestamp = Date.now();
    const outputPath = path.join(
      GENERATED_DIR,
      `${templateKey}-filled-${timestamp}.pdf`
    );

    // Ensure generated directory exists
    ensureDir(path.dirname(outputPath));

    const pdfBytes = await pdfDoc.save();
    await fs.promises.writeFile(outputPath, pdfBytes);

    console.log(`✅ Filled PDF saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error(`❌ Error filling PDF template ${templateKey}:`, error);
    throw error;
  }
}

/**
 * Get available template keys from coordinate map
 */
export function getAvailableTemplates(): string[] {
  const coordinates = currentCoordinates as { [key: string]: CoordinateMap };
  return Object.keys(coordinates);
}

/**
 * Get coordinate map for a specific template
 */
export function getTemplateCoordinates(
  templateKey: string
): CoordinateMap | null {
  const coordinates = currentCoordinates as { [key: string]: CoordinateMap };
  return coordinates[templateKey] || null;
}

/**
 * Validate that all required fields for a template are provided in contract data
 */
export function validateContractData(
  templateKey: string,
  contractData: ContractData
): { valid: boolean; missingFields: string[] } {
  const coordinates = currentCoordinates as { [key: string]: CoordinateMap };
  const coords = coordinates[templateKey];

  if (!coords) {
    return { valid: false, missingFields: [] };
  }

  const requiredFields = Object.keys(coords);
  const missingFields = requiredFields.filter((field) => !contractData[field]);

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}
