import 'dotenv/config';
import fs from 'fs';
import path from 'path';

import { PDFDocument } from 'pdf-lib';

import { getPool } from '../src/db/cloudSqlPool';
import { validateFieldManifest } from '../src/features/contracts/pdf/coordinates';
import { sha256 } from '../src/features/contracts/pdf/hash';
import { templateObjectPath } from '../src/features/contracts/pdf/templateLoader';
import { PdfTemplateField } from '../src/features/contracts/pdf/types';
import {
  downloadObject,
  uploadObjectWithMetadata,
} from '../src/services/gcs/documentStorage';
import convertToPdf from '../src/utils/convertToPdf';

interface SeedTemplate {
  identifier: string;
  version: number;
  docxFile: string;
  pdfFile: string;
  fields: readonly PdfTemplateField[];
}

export interface SeedTemplateRegistration {
  identifier: string;
  version: number;
  objectPath: string;
  sha256: string;
  fields: readonly PdfTemplateField[];
  effectiveAt: Date;
}

export interface SeedTemplateRepository {
  upsertTemplate(registration: SeedTemplateRegistration): Promise<void>;
}

export interface TemplateSeedDependencies {
  repository: SeedTemplateRepository;
  upload(
    objectName: string,
    bytes: Buffer,
    metadata: Record<string, string>
  ): Promise<{ generation: string | null; size: number | null }>;
  convertDocx(docx: Buffer): Promise<Buffer>;
  loadRegisteredPdf?(identifier: string, version: number): Promise<Buffer>;
}

export interface TemplateSeedOptions {
  dryRun: boolean;
  pdfDirectory?: string;
  templatesDirectory?: string;
  version?: number;
  sourceVersion?: number;
  effectiveAt?: Date;
}

const LETTER_WIDTH = 612;
const LETTER_HEIGHT = 792;

/** Converts measured PDF coordinates whose origin is the top-left. */
function fromTopLeftPoints(
  x: number,
  y: number,
  width: number,
  height: number
) {
  return {
    x: x / LETTER_WIDTH,
    y: y / LETTER_HEIGHT,
    width: width / LETTER_WIDTH,
    height: height / LETTER_HEIGHT,
  };
}

export const NATIVE_TEMPLATE_SEEDS: readonly SeedTemplate[] = [
  {
    identifier: 'labor_support',
    version: 1,
    docxFile: 'Labor Support Agreement for Service.docx',
    pdfFile: 'Labor Support Agreement for Service.pdf',
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 3,
        coordinates: fromTopLeftPoints(136, 252, 145, 22),
        required: true,
      },
      {
        id: 'total',
        kind: 'snapshot_text',
        source: 'pricing.totalCents',
        page: 2,
        coordinates: fromTopLeftPoints(149, 634, 120, 22),
        required: true,
      },
      {
        id: 'deposit',
        kind: 'snapshot_text',
        source: 'pricing.depositCents',
        page: 2,
        coordinates: fromTopLeftPoints(174, 658, 130, 22),
        required: true,
      },
      {
        id: 'balance',
        kind: 'snapshot_text',
        source: 'pricing.balanceCents',
        page: 2,
        coordinates: fromTopLeftPoints(148, 674, 130, 22),
        required: true,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fromTopLeftPoints(375, 248, 165, 32),
        required: true,
      },
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(275, 634, 55, 20),
        required: true,
      },
      {
        id: 'client-initials-2',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(310, 658, 55, 20),
        required: true,
      },
      {
        id: 'client-initials-3',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(285, 674, 55, 20),
        required: true,
      },
      {
        id: 'client-signing-date',
        kind: 'signing_date',
        page: 3,
        coordinates: fromTopLeftPoints(105, 296, 120, 28),
        required: true,
      },
    ],
  },
  {
    identifier: 'labor_support',
    version: 2,
    docxFile: 'Labor Support Agreement for Service.docx',
    pdfFile: 'Labor Support Agreement for Service.pdf',
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 3,
        coordinates: fromTopLeftPoints(136, 252, 145, 22),
        required: true,
      },
      {
        id: 'total',
        kind: 'snapshot_text',
        source: 'pricing.totalCents',
        page: 2,
        coordinates: fromTopLeftPoints(149, 634, 120, 22),
        required: true,
      },
      {
        id: 'deposit',
        kind: 'snapshot_text',
        source: 'pricing.depositCents',
        page: 2,
        coordinates: fromTopLeftPoints(174, 658, 130, 22),
        required: true,
      },
      {
        id: 'balance',
        kind: 'snapshot_text',
        source: 'pricing.balanceCents',
        page: 2,
        coordinates: fromTopLeftPoints(148, 674, 130, 22),
        required: true,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fromTopLeftPoints(375, 254, 170, 26),
        required: true,
      },
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(272, 634, 44, 18),
        required: true,
      },
      {
        id: 'client-initials-2',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(305, 658, 32, 18),
        required: true,
      },
      {
        id: 'client-initials-3',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(281, 674, 52, 18),
        required: true,
      },
      {
        id: 'client-signing-date',
        kind: 'signing_date',
        page: 3,
        coordinates: fromTopLeftPoints(158, 300, 112, 24),
        required: true,
      },
    ],
  },
  {
    identifier: 'labor_support',
    version: 3,
    docxFile: 'Labor Support Agreement for Service.docx',
    pdfFile: 'Labor Support Agreement for Service.pdf',
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 3,
        coordinates: fromTopLeftPoints(136, 252, 145, 22),
        required: true,
      },
      {
        id: 'total',
        kind: 'snapshot_text',
        source: 'pricing.totalCents',
        page: 2,
        coordinates: fromTopLeftPoints(149, 634, 120, 22),
        required: true,
      },
      {
        id: 'deposit',
        kind: 'snapshot_text',
        source: 'pricing.depositCents',
        page: 2,
        coordinates: fromTopLeftPoints(174, 658, 130, 22),
        required: true,
      },
      {
        id: 'balance',
        kind: 'snapshot_text',
        source: 'pricing.balanceCents',
        page: 2,
        coordinates: fromTopLeftPoints(148, 674, 130, 22),
        required: true,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fromTopLeftPoints(375, 254, 170, 26),
        required: true,
      },
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(184, 634, 28, 16),
        required: true,
      },
      {
        id: 'client-initials-2',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(209, 658, 28, 16),
        required: true,
      },
      {
        id: 'client-initials-3',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(183, 674, 28, 16),
        required: true,
      },
      {
        id: 'client-signing-date',
        kind: 'signing_date',
        page: 3,
        coordinates: fromTopLeftPoints(158, 300, 112, 24),
        required: true,
      },
    ],
  },
  {
    identifier: 'labor_support',
    version: 4,
    docxFile: 'Labor Support Agreement for Service.docx',
    pdfFile: 'Labor Support Agreement for Service.pdf',
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 3,
        coordinates: fromTopLeftPoints(136, 252, 145, 22),
        required: true,
      },
      {
        id: 'total',
        kind: 'snapshot_text',
        source: 'pricing.totalCents',
        page: 2,
        coordinates: fromTopLeftPoints(149, 634, 120, 22),
        required: true,
      },
      {
        id: 'deposit',
        kind: 'snapshot_text',
        source: 'pricing.depositCents',
        page: 2,
        coordinates: fromTopLeftPoints(174, 658, 130, 22),
        required: true,
      },
      {
        id: 'balance',
        kind: 'snapshot_text',
        source: 'pricing.balanceCents',
        page: 2,
        coordinates: fromTopLeftPoints(148, 674, 130, 22),
        required: true,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fromTopLeftPoints(375, 254, 170, 26),
        required: true,
      },
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(174, 634, 24, 14),
        required: true,
      },
      {
        id: 'client-initials-2',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(199, 658, 24, 14),
        required: true,
      },
      {
        id: 'client-initials-3',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(173, 674, 24, 14),
        required: true,
      },
      {
        id: 'client-signing-date',
        kind: 'signing_date',
        page: 3,
        coordinates: fromTopLeftPoints(105, 296, 120, 28),
        required: true,
      },
    ],
  },
  {
    identifier: 'labor_support',
    version: 5,
    docxFile: 'Labor Support Agreement for Service.docx',
    pdfFile: 'Labor Support Agreement for Service.pdf',
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 3,
        coordinates: fromTopLeftPoints(136, 252, 145, 22),
        required: true,
      },
      {
        id: 'total',
        kind: 'snapshot_text',
        source: 'pricing.totalCents',
        page: 2,
        coordinates: fromTopLeftPoints(149, 634, 120, 22),
        required: true,
      },
      {
        id: 'deposit',
        kind: 'snapshot_text',
        source: 'pricing.depositCents',
        page: 2,
        coordinates: fromTopLeftPoints(174, 658, 130, 22),
        required: true,
      },
      {
        id: 'balance',
        kind: 'snapshot_text',
        source: 'pricing.balanceCents',
        page: 2,
        coordinates: fromTopLeftPoints(148, 674, 130, 22),
        required: true,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fromTopLeftPoints(375, 254, 170, 26),
        required: true,
      },
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(272, 634, 24, 14),
        required: true,
      },
      {
        id: 'client-initials-2',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(307, 658, 24, 14),
        required: true,
      },
      {
        id: 'client-initials-3',
        kind: 'initials',
        page: 2,
        coordinates: fromTopLeftPoints(281, 674, 24, 14),
        required: true,
      },
      {
        id: 'client-signing-date',
        kind: 'signing_date',
        page: 3,
        coordinates: fromTopLeftPoints(105, 296, 120, 28),
        required: true,
      },
    ],
  },
  {
    identifier: 'postpartum',
    version: 1,
    docxFile: 'Agreement for Postpartum Doula Services.docx',
    pdfFile: 'Agreement for Postpartum Doula Services.pdf',
    fields: [
      {
        id: 'client-name',
        kind: 'snapshot_text',
        source: 'client.name',
        page: 3,
        coordinates: fromTopLeftPoints(139, 620, 160, 22),
        required: true,
      },
      {
        id: 'total-hours',
        kind: 'snapshot_text',
        source: 'selectedServices.totalHours',
        page: 2,
        coordinates: fromTopLeftPoints(228, 419, 150, 22),
        required: true,
        fontSize: 9,
      },
      {
        id: 'total',
        kind: 'snapshot_text',
        source: 'pricing.totalCents',
        page: 3,
        coordinates: fromTopLeftPoints(248, 108, 76, 22),
        required: true,
      },
      {
        id: 'deposit',
        kind: 'snapshot_text',
        source: 'pricing.depositCents',
        page: 2,
        coordinates: fromTopLeftPoints(210, 651, 100, 22),
        required: true,
      },
      {
        id: 'hourly-rate',
        kind: 'snapshot_text',
        source: 'templateValues.hourlyRateCents',
        page: 3,
        coordinates: fromTopLeftPoints(358, 68, 70, 22),
        required: true,
      },
      {
        id: 'overnight-fee',
        kind: 'snapshot_text',
        source: 'templateValues.overnightFeeCents',
        page: 3,
        coordinates: fromTopLeftPoints(258, 84, 78, 22),
        required: false,
      },
      {
        id: 'client-initials-1',
        kind: 'initials',
        page: 3,
        coordinates: fromTopLeftPoints(72, 556, 72, 22),
        required: true,
      },
      {
        id: 'client-signature',
        kind: 'signature',
        page: 3,
        coordinates: fromTopLeftPoints(165, 640, 180, 32),
        required: true,
      },
      {
        id: 'client-signing-date',
        kind: 'signing_date',
        page: 3,
        coordinates: fromTopLeftPoints(400, 640, 120, 32),
        required: true,
      },
    ],
  },
];

export class CloudSqlTemplateSeedRepository implements SeedTemplateRepository {
  async upsertTemplate(registration: SeedTemplateRegistration): Promise<void> {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE public.contract_template_versions
         SET is_active = FALSE, updated_at = clock_timestamp()
         WHERE identifier = $1 AND version <> $2 AND is_active = TRUE`,
        [registration.identifier, registration.version]
      );
      const result = await client.query(
        `INSERT INTO public.contract_template_versions
           (identifier, version, gcs_object_path, content_hash, field_manifest,
            is_active, effective_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, $6)
         ON CONFLICT (identifier, version) DO UPDATE
         SET gcs_object_path = EXCLUDED.gcs_object_path,
             field_manifest = EXCLUDED.field_manifest,
             is_active = TRUE,
             updated_at = clock_timestamp()
         WHERE contract_template_versions.content_hash = EXCLUDED.content_hash
           AND contract_template_versions.gcs_object_path = EXCLUDED.gcs_object_path
           AND contract_template_versions.field_manifest = EXCLUDED.field_manifest
         RETURNING identifier`,
        [
          registration.identifier,
          registration.version,
          registration.objectPath,
          registration.sha256,
          JSON.stringify(registration.fields),
          registration.effectiveAt,
        ]
      );
      if (result.rowCount !== 1) {
        throw new Error(
          `Template ${registration.identifier} v${registration.version} already exists with different bytes`
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const defaultTemplateSeedDependencies: TemplateSeedDependencies = {
  repository: new CloudSqlTemplateSeedRepository(),
  async upload(objectName, bytes, metadata) {
    try {
      return await uploadObjectWithMetadata(
        objectName,
        bytes,
        'application/pdf',
        {
          upsert: false,
          metadata,
        }
      );
    } catch (error) {
      const code = Number((error as { code?: unknown })?.code);
      if (code !== 409 && code !== 412) throw error;
      const existing = await downloadObject(objectName);
      if (sha256(existing) !== sha256(bytes)) {
        throw new Error(`Existing template object differs: ${objectName}`);
      }
      return { generation: null, size: existing.length };
    }
  },
  convertDocx: convertToPdf,
  async loadRegisteredPdf(identifier, version) {
    const { rows } = await getPool().query<{ gcs_object_path: string }>(
      `SELECT gcs_object_path
       FROM public.contract_template_versions
       WHERE identifier = $1 AND version = $2
       LIMIT 1`,
      [identifier, version]
    );
    const objectPath = rows[0]?.gcs_object_path;
    if (!objectPath) {
      throw new Error(
        `Registered source template not found: ${identifier} v${version}`
      );
    }
    return downloadObject(objectPath);
  },
};

async function loadPdf(
  seed: SeedTemplate,
  options: TemplateSeedOptions,
  dependencies: TemplateSeedDependencies
): Promise<Buffer> {
  const templatesDirectory =
    options.templatesDirectory ?? path.join(process.cwd(), 'templates');
  const generatedPdfPath = options.pdfDirectory
    ? path.join(options.pdfDirectory, seed.pdfFile)
    : path.join(templatesDirectory, seed.pdfFile);
  if (fs.existsSync(generatedPdfPath)) {
    return fs.promises.readFile(generatedPdfPath);
  }
  if (options.sourceVersion !== undefined) {
    if (!dependencies.loadRegisteredPdf) {
      throw new Error('Template source-version loading is not configured');
    }
    if (options.sourceVersion === seed.version) {
      throw new Error('--source-version must differ from --version');
    }
    return dependencies.loadRegisteredPdf(
      seed.identifier,
      options.sourceVersion
    );
  }
  if (options.dryRun) {
    throw new Error(
      `Dry run requires generated PDF: ${generatedPdfPath}. Use --pdf-dir <directory>.`
    );
  }
  const docx = await fs.promises.readFile(
    path.join(templatesDirectory, seed.docxFile)
  );
  return dependencies.convertDocx(docx);
}

export async function runNativeTemplateSeed(
  options: TemplateSeedOptions,
  dependencies: TemplateSeedDependencies = defaultTemplateSeedDependencies
): Promise<SeedTemplateRegistration[]> {
  const effectiveAt = options.effectiveAt ?? new Date();
  const registrations: SeedTemplateRegistration[] = [];

  for (const baseSeed of NATIVE_TEMPLATE_SEEDS) {
    if (options.version !== undefined && baseSeed.version !== options.version) {
      continue;
    }
    const seed = baseSeed;
    const pdfBytes = await loadPdf(seed, options, dependencies);
    const pdf = await PDFDocument.load(pdfBytes);
    validateFieldManifest(seed.fields, pdf.getPageCount());
    const contentHash = sha256(pdfBytes);
    const gcsPath = templateObjectPath(
      seed.identifier,
      seed.version,
      contentHash
    );
    const registration: SeedTemplateRegistration = {
      identifier: seed.identifier,
      version: seed.version,
      objectPath: gcsPath,
      sha256: contentHash,
      fields: seed.fields,
      effectiveAt,
    };
    registrations.push(registration);

    console.info(
      `[template-seed] ${options.dryRun ? 'would register' : 'registering'} ` +
        `${seed.identifier} v${seed.version} at ${gcsPath} sha256=${contentHash}`
    );
    if (!options.dryRun) {
      await dependencies.upload(gcsPath, pdfBytes, {
        sha256: contentHash,
        templateIdentifier: seed.identifier,
        templateVersion: String(seed.version),
      });
      await dependencies.repository.upsertTemplate(registration);
    }
  }
  return registrations;
}

function readOption(args: readonly string[], name: string): string | undefined {
  const equals = args.find((arg) => arg.startsWith(`${name}=`));
  if (equals) return equals.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseCliOptions(args: readonly string[]): TemplateSeedOptions {
  const versionValue = readOption(args, '--version');
  const version = versionValue === undefined ? undefined : Number(versionValue);
  if (version !== undefined && (!Number.isInteger(version) || version < 1)) {
    throw new Error('--version must be a positive integer');
  }
  const sourceVersionValue = readOption(args, '--source-version');
  const sourceVersion =
    sourceVersionValue === undefined ? undefined : Number(sourceVersionValue);
  if (
    sourceVersion !== undefined &&
    (!Number.isInteger(sourceVersion) || sourceVersion < 1)
  ) {
    throw new Error('--source-version must be a positive integer');
  }
  if (sourceVersion !== undefined && version === undefined) {
    throw new Error('--source-version requires --version');
  }
  return {
    dryRun: args.includes('--dry-run'),
    pdfDirectory: readOption(args, '--pdf-dir'),
    templatesDirectory: readOption(args, '--templates-dir'),
    version,
    sourceVersion,
  };
}

if (require.main === module) {
  const options = parseCliOptions(process.argv.slice(2));
  void (async () => {
    try {
      await runNativeTemplateSeed(options);
    } catch (error: unknown) {
      console.error(
        `[template-seed] failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
      process.exitCode = 1;
    } finally {
      if (!options.dryRun) await getPool().end();
    }
  })();
}
