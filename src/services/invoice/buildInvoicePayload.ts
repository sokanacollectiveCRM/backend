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
  opts: { lineItems: RawLineItem[]; dueDate: string; memo?: string; customerEmail: string }
) {
  const { lineItems, dueDate, memo, customerEmail } = opts;
  return {
    CustomerRef: { value: qboCustomerId },
    Line: lineItems,
    TxnDate: dueDate,
    DueDate: dueDate,
    PrivateNote: memo || "",
    BillEmail: { Address: customerEmail },
    AllowOnlineACHPayment: true,
    AllowOnlineCreditCardPayment: true,
    EmailStatus: "NeedToSend",
    domain: "QBO",
    sparse: false
  };
}
