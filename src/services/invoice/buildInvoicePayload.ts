// src/features/quickbooks/services/invoice/buildInvoicePayload.ts

export interface SalesItemLineDetail {
  ItemRef: { value: string };
  UnitPrice?: number;
  Qty: number;
}

export interface InvoiceLineItem {
  DetailType: string;
  Amount: number;
  Description?: string;
  SalesItemLineDetail: SalesItemLineDetail;
}

export interface BuildInvoicePayloadOptions {
  lineItems: InvoiceLineItem[];
  dueDate: string;
  memo?: string;
}

export default function buildInvoicePayload(
  customerId: string,
  { lineItems, dueDate, memo }: BuildInvoicePayloadOptions
) {
  return {
    CustomerRef: { value: customerId },
    Line: lineItems.map(item => ({
      DetailType: item.DetailType,
      Amount:     item.Amount,
      Description:item.Description,
      SalesItemLineDetail: {
        ItemRef:   item.SalesItemLineDetail.ItemRef,
        UnitPrice: item.SalesItemLineDetail.UnitPrice ?? item.Amount,
        Qty:       item.SalesItemLineDetail.Qty
      }
    })),
    DueDate:     dueDate,
    PrivateNote: memo
  };
}
