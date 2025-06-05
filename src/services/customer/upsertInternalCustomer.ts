import supabase from '../../supabase';

export default async function upsertInternalCustomer(
  internalCustomerId: string,
  fullName: string,
  email: string
): Promise<any> {
  const { data, error } = await supabase
    .from('customers')
    .upsert(
      { id: internalCustomerId, name: fullName, email },
      { onConflict: 'id' }
    )
    .single();

  if (error) {
    throw new Error(`Supabase error upserting internal customer: ${error.message}`);
  }

  return data;
}
