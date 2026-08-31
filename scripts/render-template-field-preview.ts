import fs from 'fs';
import path from 'path';

import { PDFDocument } from 'pdf-lib';

import { renderFieldPreviewPdf } from '../src/features/contracts/pdf/fieldPreview';

const { NATIVE_TEMPLATE_SEEDS } =
  require('./seed-native-contract-templates') as {
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
  };

async function main() {
  const identifier = process.argv[2] ?? 'labor_support';
  const version = Number(process.argv[3] ?? '2');
  const seed = NATIVE_TEMPLATE_SEEDS.find(
    (item) => item.identifier === identifier && item.version === version
  );
  if (!seed) {
    throw new Error(`Template ${identifier} v${version} not found`);
  }

  const templatesDirectory = path.join(process.cwd(), 'templates');
  const pdfPath = path.join(templatesDirectory, seed.pdfFile);
  let pdfBytes: Buffer;
  if (fs.existsSync(pdfPath)) {
    pdfBytes = await fs.promises.readFile(pdfPath);
  } else {
    const pdf = await PDFDocument.create();
    for (let index = 0; index < 3; index += 1) pdf.addPage([612, 792]);
    pdfBytes = Buffer.from(await pdf.save());
    console.warn(
      `[field-preview] ${pdfPath} missing; using synthetic ${pdf.getPageCount()}-page PDF`
    );
  }

  const outputDirectory = path.join(process.cwd(), 'tmp', 'template-previews');
  await fs.promises.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    `${identifier}-v${version}-fields.pdf`
  );
  await renderFieldPreviewPdf(pdfBytes, seed.fields, { outputPath });
  console.info(`[field-preview] wrote ${outputPath}`);
}

void main().catch((error: unknown) => {
  console.error(
    `[field-preview] failed: ${
      error instanceof Error ? error.message : 'unknown error'
    }`
  );
  process.exitCode = 1;
});
