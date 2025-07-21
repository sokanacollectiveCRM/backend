"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getInvoiceableCustomers;
async function getInvoiceableCustomers(supabase) {
    const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, qbo_customer_id')
        .order('name', { ascending: true });
    if (error)
        throw new Error(`Error fetching customers: ${error.message}`);
    return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        qboCustomerId: row.qbo_customer_id,
    }));
}
