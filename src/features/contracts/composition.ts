import { createHash } from 'crypto';

import { nativeContracts } from '../../config/env';
import { resolveBillingPath } from '../../constants/portalEligibility';
import { queryCloudSql } from '../../db/cloudSqlPool';
import { createPaymentScheduleInCloudSql } from '../../services/cloudSqlPaymentScheduleService';
import {
  GCS_PREFIX,
  downloadObject,
  getSignedReadUrl,
  objectPath,
  uploadObjectWithMetadata,
} from '../../services/gcs/documentStorage';
import { ContractController } from './controllers/contractController';
import { SigningController } from './controllers/signingController';
import { shouldCreateClientPaymentSchedule } from './domain/billing';
import { NativeContractPdfService } from './pdf/pdfService';
import { gcsPdfObjectStorage } from './pdf/templateLoader';
import { contractRepository } from './repositories/contractRepository';
import { invitationRepository } from './repositories/invitationRepository';
import { signingAccessSessionRepository } from './repositories/signingAccessSessionRepository';
import { signingSessionRepository } from './repositories/signingSessionRepository';
import { templateRepository } from './repositories/templateRepository';
import { createAdminContractRoutes } from './routes/adminContractRoutes';
import { createClientContractRoutes } from './routes/clientContractRoutes';
import { createSigningRoutes } from './routes/signingRoutes';
import {
  ContractEntity,
  ContractService,
  NodemailerContractInvitationMailer,
} from './services/contractService';
import { InvitationService } from './services/invitationService';
import {
  PostgresRateLimitStore,
  RateLimitService,
} from './services/rateLimitService';
import { SigningAccessSessionService } from './services/signingAccessSessionService';
import {
  SignedPdfFinalizer,
  SigningSessionService,
} from './services/signingSessionService';

const pdf = new NativeContractPdfService({
  templates: templateRepository,
  storage: gcsPdfObjectStorage,
  artifacts: {
    findByHash: (contractId, kind, sha256) =>
      contractRepository.findPdfArtifactByHash(contractId, kind, sha256),
  },
});

const invitationService = new InvitationService(
  invitationRepository,
  contractRepository,
  nativeContracts.invitationTtlHours * 60 * 60 * 1000
);

const finalizer: SignedPdfFinalizer = {
  async finalize(input) {
    const unsignedPdf = await downloadObject(input.contract.unsignedPdfObject);
    let signatureObjectPath: string | null = null;
    if (input.signature.type === 'drawn') {
      const bytes = Buffer.from(
        input.signature.dataUrl.split(',', 2)[1],
        'base64'
      );
      const hash = createHash('sha256').update(bytes).digest('hex');
      signatureObjectPath = objectPath(
        GCS_PREFIX.contracts,
        `${input.contract.id}/signatures/${hash}.png`
      );
      await uploadObjectWithMetadata(signatureObjectPath, bytes, 'image/png', {
        upsert: true,
        metadata: { sha256: hash },
      });
    }
    const artifact = await pdf.complete({
      snapshot: input.contract.snapshot,
      unsignedPdf,
      expectedUnsignedSha256: input.contract.unsignedPdfSha256,
      adoptedSignature: {
        value: input.signature,
        initials: input.initials,
        acknowledgedFieldIds: input.completedFieldIds,
      },
      signerName: input.signerName,
      evidenceId: `signature-${input.contract.id}`,
      correlationId:
        input.correlationId ?? `contract-completion-${input.contract.id}`,
    });
    return {
      objectName: artifact.path,
      sha256: artifact.sha256,
      generation: artifact.generation,
      signatureObjectPath,
    };
  },
};

const contractService = new ContractService(
  contractRepository,
  invitationService,
  {
    async freezeUnsigned(contract: ContractEntity) {
      const artifact = await pdf.generateUnsigned(contract.snapshot);
      return {
        objectName: artifact.path,
        sha256: artifact.sha256,
        generation: artifact.generation,
      };
    },
  },
  { signedReadUrl: getSignedReadUrl },
  {
    build(snapshot) {
      return snapshot.pricing.installmentCents;
    },
  },
  templateRepository,
  {
    async ensure(snapshot) {
      const clientId = snapshot.client.id;
      if (!clientId) return;
      const { rows } = await queryCloudSql<{ payment_method: string | null }>(
        `SELECT payment_method
         FROM public.phi_clients
         WHERE id = $1::uuid
         LIMIT 1`,
        [clientId]
      );
      const billingPath = resolveBillingPath(rows[0]?.payment_method);
      if (!shouldCreateClientPaymentSchedule(snapshot, billingPath)) {
        return;
      }
      await createPaymentScheduleInCloudSql({
        contractId: snapshot.contractId,
        scheduleName: 'Labor Support Payment Plan',
        totalAmount: snapshot.pricing.totalCents / 100,
        depositAmount: snapshot.pricing.depositCents / 100,
        numberOfInstallments: 3,
        paymentFrequency: 'monthly',
        startDate: snapshot.createdAt,
      });
    },
  },
  new NodemailerContractInvitationMailer(),
  nativeContracts.signingBaseUrl
);

const rateLimitService = new RateLimitService(
  new PostgresRateLimitStore(),
  nativeContracts.rateLimitHmacSecret,
  nativeContracts.rateLimitAttempts,
  nativeContracts.rateLimitWindowSeconds
);

const signingAccessSessionService = new SigningAccessSessionService(
  invitationService,
  signingAccessSessionRepository,
  rateLimitService
);

const signingService = new SigningSessionService(
  invitationService,
  signingSessionRepository,
  rateLimitService,
  finalizer,
  { signedReadUrl: getSignedReadUrl, download: downloadObject },
  nativeContracts.pdfUrlTtlSeconds
);

export const nativeContractController = new ContractController(contractService);
export const nativeSigningController = new SigningController(
  signingService,
  signingAccessSessionService
);
export const nativeAdminContractRoutes = createAdminContractRoutes(
  nativeContractController
);
export const nativeClientContractRoutes = createClientContractRoutes(
  nativeContractController
);
export const nativeSigningRoutes = createSigningRoutes(nativeSigningController);
export { contractService as nativeContractService };
export { invitationService as nativeInvitationService };
export { pdf as nativeContractPdfService };
