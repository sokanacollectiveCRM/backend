import { createClient } from '@supabase/supabase-js';
import { SupabaseUserRepository } from '../../repositories/supabaseUserRepository';
import buildCustomerPayload, { BuildCustomerPayloadResult } from './buildCustomerPayload';
import createCustomerInQuickBooks from './createCustomerInQuickBooks';
import saveQboCustomerId from './saveQboCustomerId';
import upsertInternalCustomer from './upsertInternalCustomer';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
const userRepository = new SupabaseUserRepository(supabase)


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

   // 5) Update client_info status to 'customer'
   await userRepository.updateClientStatusToCustomer(internalCustomerId);

  return { internalCustomerId, qboCustomerId: qboCustomer.Id, fullName };
}
