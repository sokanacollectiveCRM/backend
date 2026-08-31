import 'dotenv/config';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { PDFDocument } from 'pdf-lib';

import { nativeContracts } from '../src/config/env';
import { getPool } from '../src/db/cloudSqlPool';
import {
  nativeContractPdfService,
  nativeContractService,
  nativeInvitationService,
} from '../src/features/contracts/composition';
import { contractRepository } from '../src/features/contracts/repositories/contractRepository';
import {
  NATIVE_TEMPLATE_SEEDS,
  runNativeTemplateSeed,
} from './seed-native-contract-templates';

async function writeSeedPdf(directory: string): Promise<void> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < 3; index += 1) pdf.addPage([612, 792]);
  const bytes = Buffer.from(await pdf.save());
  const laborPdf = NATIVE_TEMPLATE_SEEDS.find(
    (seed) => seed.identifier === 'labor_support' && seed.version === 2
  )!.pdfFile;
  await fs.writeFile(path.join(directory, laborPdf), bytes);
}

async function resolveClientId(explicitClientId?: string): Promise<string> {
  if (explicitClientId) return explicitClientId;
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT id FROM public.phi_clients ORDER BY created_at ASC LIMIT 1`
  );
  const clientId = rows[0]?.id;
  if (!clientId) {
    throw new Error(
      'No client found. Pass --client-id <uuid> for the test contract.'
    );
  }
  return clientId;
}

async function main(): Promise<void> {
  if (process.env.ALLOW_SYNTHETIC_NATIVE_TEMPLATE_SEED !== 'true') {
    throw new Error(
      'Refusing to activate a synthetic blank template. Set ' +
        'ALLOW_SYNTHETIC_NATIVE_TEMPLATE_SEED=true only in an isolated test database.'
    );
  }

  const clientIdArg = process.argv.find((arg) =>
    arg.startsWith('--client-id=')
  );
  const clientId = await resolveClientId(clientIdArg?.split('=')[1]);

  const pdfDirectory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'labor-support-v2-seed-')
  );
  await writeSeedPdf(pdfDirectory);

  console.info('[create-labor-support-v2-test] seeding labor_support v2...');
  await runNativeTemplateSeed({ version: 2, pdfDirectory });

  console.info('[create-labor-support-v2-test] creating draft contract...');
  const draft = await nativeContractService.createDraft(
    {
      templateId: 'labor_support',
      clientId,
      clientName: 'Labor Support V2 Test Client',
      clientEmail: 'labor-v2-test@example.test',
      serviceType: 'Labor Support Services',
      selectedServices: [
        {
          id: 'labor-support-flat',
          name: 'Labor Support Services',
          type: 'flat',
          amount: '1.00',
        },
      ],
      deposit: { type: 'fixed', value: '1.00' },
      installmentsCount: 1,
      adminFeeAmount: 0,
    },
    'system'
  );

  const contract = await contractRepository.findById(draft.contractId);
  if (!contract) throw new Error('Draft contract was not found after creation');
  if (contract.snapshot.templateVersion !== 2) {
    throw new Error(
      `Expected templateVersion 2, received ${contract.snapshot.templateVersion}`
    );
  }

  const frozen = await nativeContractPdfService.generateUnsigned(
    contract.snapshot
  );
  const prepared = nativeInvitationService.prepare(
    contract.id,
    contract.clientId
  );

  await contractRepository.sendAtomically({
    contractId: contract.id,
    actorId: 'system',
    unsignedPdfObject: frozen.path,
    unsignedPdfSha256: frozen.sha256,
    unsignedPdfGeneration: frozen.generation,
    paymentSchedule: contract.snapshot.pricing.installmentCents,
    invitation: prepared.input,
    replaceInvitation: false,
  });

  const signingUrl = `${nativeContracts.signingBaseUrl}/${encodeURIComponent(
    prepared.token
  )}`;

  console.info('[create-labor-support-v2-test] contract created and sent');
  console.info(`contractId=${contract.id}`);
  console.info(`templateVersion=${contract.snapshot.templateVersion}`);
  console.info(`signingUrl=${signingUrl}`);
  console.info(
    'initials=' +
      contract.snapshot.fields
        .filter((field) => field.id.startsWith('client-initials'))
        .map(
          (field) => `${field.id}@x=${Math.round(field.coordinates.x * 612)}`
        )
        .join(', ')
  );
}

void main()
  .catch((error: unknown) => {
    console.error(
      `[create-labor-support-v2-test] failed: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await getPool().end();
  });
