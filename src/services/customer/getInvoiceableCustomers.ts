// src/services/customer/getInvoiceableCustomers.ts
//
// Returns CRM clients that have been converted to customers (status = 'matched')
// and have a qbo_customer_id stored in phi_clients (Cloud SQL).
// The old Supabase 'customers' table is no longer used.

import { queryCloudSql } from '../../db/cloudSqlPool';

export interface InvoiceableCustomer {
  id: string;
  name: string;
  email: string;
  qboCustomerId: string | null;
}

export default async function getInvoiceableCustomers(): Promise<InvoiceableCustomer[]> {
  const { rows } = await queryCloudSql<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    qbo_customer_id: string | null;
  }>(
    `SELECT id, first_name, last_name, email, qbo_customer_id
     FROM phi_clients
     WHERE status = 'matched'
     ORDER BY last_name ASC, first_name ASC`
  );

  return rows.map((row) => ({
    id: row.id,
    name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.email || row.id,
    email: row.email || '',
    qboCustomerId: row.qbo_customer_id,
  }));
}
