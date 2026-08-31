import fs from 'fs';
import os from 'os';
import path from 'path';

import { PDFDocument } from 'pdf-lib';

interface SeedTemplateRepository {
  upsertTemplate(registration: unknown): Promise<void>;
}

interface TemplateSeedDependencies {
  repository: SeedTemplateRepository;
  upload(
    objectName: string,
    bytes: Buffer,
    metadata: Record<string, string>
  ): Promise<{ generation: string | null; size: number | null }>;
  convertDocx(docx: Buffer): Promise<Buffer>;
  loadRegisteredPdf?(identifier: string, version: number): Promise<Buffer>;
}

interface SeedRegistration {
  identifier: string;
  version: number;
  objectPath: string;
  sha256: string;
}

const {
  NATIVE_TEMPLATE_SEEDS,
  runNativeTemplateSeed,
}: {
  NATIVE_TEMPLATE_SEEDS: readonly {
    identifier: string;
    pdfFile: string;
  }[];
  runNativeTemplateSeed(
    options: {
      dryRun: boolean;
      pdfDirectory?: string;
      effectiveAt?: Date;
      version?: number;
      sourceVersion?: number;
    },
    dependencies: TemplateSeedDependencies
  ): Promise<SeedRegistration[]>;
} = require('../../../../scripts/seed-native-contract-templates');

async function makePdf(pageCount: number): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([612, 792]);
  }
  return Buffer.from(await pdf.save());
}

describe('native contract template seed', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'native-template-seed-')
    );
    const pdf = await makePdf(3);
    await Promise.all(
      NATIVE_TEMPLATE_SEEDS.map((seed) =>
        fs.promises.writeFile(path.join(directory, seed.pdfFile), pdf)
      )
    );
  });

  afterEach(async () => {
    await fs.promises.rm(directory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  function dependencies() {
    const repository: SeedTemplateRepository = {
      upsertTemplate: jest.fn().mockResolvedValue(undefined),
    };
    const deps: TemplateSeedDependencies = {
      repository,
      upload: jest.fn().mockResolvedValue({ generation: '100', size: 1000 }),
      convertDocx: jest.fn().mockRejectedValue(new Error('must not convert')),
    };
    return deps;
  }

  it('dry-run hashes and validates generated PDFs without external writes', async () => {
    const deps = dependencies();

    const registrations = await runNativeTemplateSeed(
      {
        dryRun: true,
        pdfDirectory: directory,
        effectiveAt: new Date('2026-08-29T00:00:00.000Z'),
      },
      deps
    );

    expect(registrations).toHaveLength(6);
    expect(registrations.map((item) => item.identifier)).toEqual([
      'labor_support',
      'labor_support',
      'labor_support',
      'labor_support',
      'labor_support',
      'postpartum',
    ]);
    for (const registration of registrations) {
      expect(registration.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(registration.objectPath).toBe(
        `contract-templates/${registration.identifier}/v${registration.version}/${registration.sha256}.pdf`
      );
    }
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.repository.upsertTemplate).not.toHaveBeenCalled();
    expect(deps.convertDocx).not.toHaveBeenCalled();
  });

  it('uses deterministic paths and upserts the same registrations on rerun', async () => {
    const deps = dependencies();
    const options = {
      dryRun: false,
      pdfDirectory: directory,
      effectiveAt: new Date('2026-08-29T00:00:00.000Z'),
    };

    const first = await runNativeTemplateSeed(options, deps);
    const second = await runNativeTemplateSeed(options, deps);

    expect(second).toEqual(first);
    expect(deps.upload).toHaveBeenCalledTimes(12);
    expect(deps.repository.upsertTemplate).toHaveBeenCalledTimes(12);
    expect(deps.convertDocx).not.toHaveBeenCalled();
    expect((deps.upload as jest.Mock).mock.calls[0][2]).toEqual(
      expect.objectContaining({
        sha256: first[0].sha256,
        templateIdentifier: first[0].identifier,
      })
    );
  });

  it('seeds only the requested template version when --version is provided', async () => {
    const deps = dependencies();

    const registrations = await runNativeTemplateSeed(
      {
        dryRun: true,
        pdfDirectory: directory,
        version: 2,
      },
      deps
    );

    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject({
      identifier: 'labor_support',
      version: 2,
    });
  });

  it('can reuse registered PDF bytes for a coordinate-only version', async () => {
    const deps = dependencies();
    const sourcePdf = await makePdf(3);
    deps.loadRegisteredPdf = jest.fn().mockResolvedValue(sourcePdf);

    const registrations = await runNativeTemplateSeed(
      {
        dryRun: false,
        pdfDirectory: path.join(directory, 'missing'),
        version: 5,
        sourceVersion: 4,
      },
      deps
    );

    expect(deps.loadRegisteredPdf).toHaveBeenCalledWith('labor_support', 4);
    expect(registrations).toHaveLength(1);
    expect(registrations[0]).toMatchObject({
      identifier: 'labor_support',
      version: 5,
    });
    expect(deps.convertDocx).not.toHaveBeenCalled();
  });

  it('rejects a manifest page outside generated PDF bounds before upload', async () => {
    const deps = dependencies();
    const onePage = await makePdf(1);
    const postpartum = NATIVE_TEMPLATE_SEEDS.find(
      (seed) => seed.identifier === 'postpartum'
    );
    await fs.promises.writeFile(
      path.join(directory, postpartum!.pdfFile),
      onePage
    );

    await expect(
      runNativeTemplateSeed({ dryRun: true, pdfDirectory: directory }, deps)
    ).rejects.toThrow('references page 3');
    expect(deps.upload).not.toHaveBeenCalled();
    expect(deps.repository.upsertTemplate).not.toHaveBeenCalled();
  });
});
