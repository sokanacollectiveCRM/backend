// src/features/quickbooks/services/invoice/buildInvoicePayload.ts
export interface RawLineItem {
  DetailType: string;
  Amount: number;
  Description?: string;
  SalesItemLineDetail: {
    ItemRef: { value: string };
    UnitPrice: number;
    Qty: number;
  };
}

/**
 * Construct a QuickBooks Invoice payload with the correct QBO customer reference
 */
export default function buildInvoicePayload(
  qboCustomerId: string,
  opts: { lineItems: RawLineItem[]; dueDate: string; memo?: string }
) {
  const { lineItems, dueDate, memo } = opts;
  return {
    CustomerRef: { value: qboCustomerId },
    Line: lineItems,
    TxnDate: dueDate,
    PrivateNote: memo || "",
  };
}
