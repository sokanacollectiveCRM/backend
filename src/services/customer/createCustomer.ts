import { getPool } from '../../db/cloudSqlPool';
import buildCustomerPayload, {
  BuildCustomerPayloadResult,
} from './buildCustomerPayload';
import createCustomerInQuickBooks from './createCustomerInQuickBooks';
import saveQboCustomerId from './saveQboCustomerId';
import saveQboCustomerIdToPhiClient from './saveQboCustomerIdToPhiClient';
import upsertInternalCustomer from './upsertInternalCustomer';

export interface CreateCustomerParams {
  internalCustomerId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CreateCustomerResult {
  internalCustomerId: string;
  qboCustomerId: string;
  fullName: string;
}

export default async function createCustomer(
  params: CreateCustomerParams
): Promise<CreateCustomerResult> {
  const { internalCustomerId, firstName, lastName, email } = params;

  if (!internalCustomerId || !firstName || !lastName || !email) {
    throw new Error('Missing required fields to create customer.');
  }

  // 1) Build payload
  const { fullName, payload }: BuildCustomerPayloadResult =
    buildCustomerPayload(firstName, lastName, email);

  // 2) Upsert internal record
  await upsertInternalCustomer(internalCustomerId, fullName, email);

  // 3) Create in QuickBooks
  const qboCustomer = await createCustomerInQuickBooks(payload);

  // 4) Save QBO customer ID back internally
  await saveQboCustomerId(internalCustomerId, qboCustomer.Id);

  // 5) Mirror the QuickBooks id onto phi_clients when this id is a client.
  try {
    await saveQboCustomerIdToPhiClient(internalCustomerId, qboCustomer.Id);
    await getPool().query(
      `UPDATE public.phi_clients
       SET status = 'customer', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1::uuid`,
      [internalCustomerId]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('phi_client not found')) throw err;
  }

  return { internalCustomerId, qboCustomerId: qboCustomer.Id, fullName };
}
