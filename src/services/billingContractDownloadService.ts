import { nativeContracts } from '../config/env';
import { queryCloudSql } from '../db/cloudSqlPool';
import { ContractNotFoundError } from '../features/contracts/services/contractService';
import { downloadObject } from './gcs/documentStorage';
import { getLimitedBillingContractById } from './limitedBillingContractsService';

export class BillingContractDownloadError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
  }
}

async function assertBillingSignedContractAvailable(
  contractId: string
): Promise<void> {
  if (!nativeContracts.enabled) {
    throw new BillingContractDownloadError(
      'Signed contract downloads are unavailable',
      503,
      'NATIVE_CONTRACTS_DISABLED'
    );
  }

  const billingContract = await getLimitedBillingContractById(contractId);
  if (!billingContract) {
    throw new BillingContractDownloadError(
      'Billing contract not found',
      404,
      'NOT_FOUND'
    );
  }

  const status = billingContract.contractStatus?.toLowerCase();
  if (status !== 'signed' && !billingContract.signedAt) {
    throw new BillingContractDownloadError(
      'Signed contract PDF is not available yet',
      409,
      'CONTRACT_NOT_SIGNED'
    );
  }
}

export async function getBillingContractDownloadLink(
  contractId: string,
  actor: { type: 'user'; id: string }
): Promise<{ url: string; expiresInSeconds: number }> {
  await assertBillingSignedContractAvailable(contractId);

  // Lazy load keeps native contract wiring optional when the feature flag is off.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { nativeContractService } =
    require('../features/contracts/composition') as {
      nativeContractService: {
        getDownload: (
          contractId: string,
          clientId: undefined,
          actor: { type: 'user'; id: string }
        ) => Promise<{ url: string; expiresInSeconds: number }>;
      };
    };

  try {
    return await nativeContractService.getDownload(
      contractId,
      undefined,
      actor
    );
  } catch (error) {
    if (error instanceof ContractNotFoundError) {
      throw new BillingContractDownloadError(
        'Signed contract PDF is not available',
        404,
        'NOT_FOUND'
      );
    }
    throw error;
  }
}

export async function getBillingContractDocument(
  contractId: string
): Promise<{ bytes: Buffer; fileName: string }> {
  await assertBillingSignedContractAvailable(contractId);

  const { rows } = await queryCloudSql<{
    signed_document_path: string | null;
    status: string;
  }>(
    `SELECT signed_document_path, status
     FROM public.phi_contracts
     WHERE id = $1::uuid
       AND signing_provider = 'native'`,
    [contractId]
  );
  const contract = rows[0];
  if (!contract?.signed_document_path || contract.status !== 'signed') {
    throw new BillingContractDownloadError(
      'Signed contract PDF is not available',
      404,
      'NOT_FOUND'
    );
  }

  const bytes = await downloadObject(contract.signed_document_path);
  return {
    bytes,
    fileName: `signed-contract-${contractId}.pdf`,
  };
}
