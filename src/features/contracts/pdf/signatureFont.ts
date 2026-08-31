import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont } from 'pdf-lib';

/** Great Vibes (OFL) — cursive signature font for typed signatures on completed PDFs. */
const FONT_FILE = 'GreatVibes-Regular.ttf';

function resolveFontPath(): string {
  const candidates = [
    join(__dirname, 'assets', FONT_FILE),
    join(process.cwd(), 'src/features/contracts/pdf/assets', FONT_FILE),
    join(process.cwd(), 'dist/features/contracts/pdf/assets', FONT_FILE),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('Typed signature font asset is missing');
}

let cachedFontBytes: Buffer | null = null;

function loadFontBytes(): Buffer {
  if (!cachedFontBytes) {
    cachedFontBytes = readFileSync(resolveFontPath());
  }
  return cachedFontBytes;
}

export async function embedTypedSignatureFont(
  pdf: PDFDocument
): Promise<PDFFont> {
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(loadFontBytes());
}
