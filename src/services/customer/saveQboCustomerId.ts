import supabase from '../../supabase';

export default async function saveQboCustomerId(
  internalCustomerId: string,
  qboCustomerId: string
): Promise<void> {
  const { error } = await supabase
    .from('customers')
    .update({ qbo_customer_id: qboCustomerId })
    .eq('id', internalCustomerId);

  if (error) {
    throw new Error(`Supabase error saving qbo_customer_id: ${error.message}`);
  }
}
