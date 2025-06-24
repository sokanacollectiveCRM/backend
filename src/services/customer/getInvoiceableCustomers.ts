// src/features/customer/getInvoiceableCustomers.ts
import { SupabaseClient } from '@supabase/supabase-js';

export interface InvoiceableCustomer {
  id: string;               // UUID PK
  name: string;             // full name
  email: string;
  qboCustomerId: string | null;
}

export default async function getInvoiceableCustomers(
  supabase: SupabaseClient
): Promise<InvoiceableCustomer[]> {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, email, qbo_customer_id')
    .order('name', { ascending: true });

  if (error) throw new Error(`Error fetching customers: ${error.message}`);

  return (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    qboCustomerId: row.qbo_customer_id,
  }));
}
