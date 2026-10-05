import { PDFDocument, rgb } from 'pdf-lib';

import { toPdfBox } from './coordinates';
import { PdfTemplateField } from './types';

interface TopLeftBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function topLeftBoxFromPoints(
  x: number,
  y: number,
  width: number,
  height: number,
  pageWidth = 612,
  pageHeight = 792
): TopLeftBox {
  return {
    x: x / pageWidth,
    y: y / pageHeight,
    width: width / pageWidth,
    height: height / pageHeight,
  };
}

export function boxesOverlap(left: TopLeftBox, right: TopLeftBox): boolean {
  return !(
    left.x + left.width <= right.x ||
    right.x + right.width <= left.x ||
    left.y + left.height <= right.y ||
    right.y + right.height <= left.y
  );
}

export function horizontalGap(left: TopLeftBox, right: TopLeftBox): number {
  if (left.x + left.width <= right.x) return right.x - (left.x + left.width);
  if (right.x + right.width <= left.x) return left.x - (right.x + right.width);
  return 0;
}

export async function renderFieldPreviewPdf(
  pdfBytes: Buffer,
  fields: readonly PdfTemplateField[],
  options?: { outputPath?: string }
): Promise<Buffer> {
  const pdf = await PDFDocument.load(pdfBytes);
  const colors: Record<string, ReturnType<typeof rgb>> = {
    snapshot_text: rgb(0.2, 0.4, 0.9),
    initials: rgb(0.95, 0.75, 0.1),
    signature: rgb(0.1, 0.65, 0.35),
    signing_date: rgb(0.55, 0.2, 0.75),
    acknowledgment: rgb(0.85, 0.3, 0.3),
  };

  for (const field of fields) {
    const page = pdf.getPage(field.page - 1);
    const box = toPdfBox(page, field.coordinates);
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      borderColor: colors[field.kind] ?? rgb(0, 0, 0),
      borderWidth: 1,
      color: rgb(1, 1, 1),
      opacity: 0,
    });
  }

  const output = Buffer.from(await pdf.save());
  if (options?.outputPath) {
    const fs = await import('fs/promises');
    await fs.writeFile(options.outputPath, output);
  }
  return output;
}
