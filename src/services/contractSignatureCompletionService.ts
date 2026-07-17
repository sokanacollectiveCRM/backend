import { queryCloudSql } from '../db/cloudSqlPool';
import createInvoiceService from './invoice/createInvoice';
import { portalEligibilityService } from './portalEligibilityService';

const DEFAULT_SERVICE_ITEM_ID = process.env.QBO_DEPOSIT_ITEM_ID || '1';

interface ContractRow {
  contract_id: string;
  client_id: string;
  status: string | null;
}

interface DepositInstallmentRow {
  id: string;
  amount: string | number;
  due_date: string | null;
  qbo_invoice_id?: string | null;
}

export interface ContractSignatureCompletionResult {
  contract_id: string | null;
  client_id: string | null;
  contract_marked_signed: boolean;
  deposit_invoice_created: boolean;
  deposit_invoice_id: string | null;
  payment_link: string | null;
  reason?: string;
}

function parseAmount(value: string | number): number {
  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid deposit amount: ${value}`);
  }
  return Math.round(parsed * 100) / 100;
}

export class ContractSignatureCompletionService {
  async finalizeSignedDocument(
    signnowDocumentId: string
  ): Promise<ContractSignatureCompletionResult> {
    const contracts = await queryCloudSql<ContractRow>(
      `SELECT id AS contract_id, client_id, status
       FROM public.phi_contracts
       WHERE signnow_document_id = $1
       LIMIT 1`,
      [signnowDocumentId]
    );

    const contract = contracts.rows[0];
    if (!contract) {
      return {
        contract_id: null,
        client_id: null,
        contract_marked_signed: false,
        deposit_invoice_created: false,
        deposit_invoice_id: null,
        payment_link: null,
        reason: 'contract_not_found',
      };
    }

    const alreadySigned = contract.status === 'signed';
    if (!alreadySigned) {
      await queryCloudSql(
        `UPDATE public.phi_contracts
         SET status = 'signed',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [contract.contract_id]
      );
    }

    const snapshot = await portalEligibilityService.computeAndPersist(
      contract.client_id,
      {
        force_contract_signed: true,
        event_source: 'signnow_status_sync',
      }
    );

    const installmentRows = await queryCloudSql<DepositInstallmentRow>(
      `SELECT
         pi.id,
         pi.amount,
         pi.due_date::text,
         NULLIF(to_jsonb(pi)->>'qbo_invoice_id', '') AS qbo_invoice_id
       FROM public.payment_installments pi
       JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
       WHERE ps.contract_id = $1
         AND COALESCE(pi.payment_type, '') = 'deposit'
       ORDER BY pi.due_date ASC NULLS LAST, pi.created_at ASC
       LIMIT 1`,
      [contract.contract_id]
    );

    const depositInstallment = installmentRows.rows[0];
    if (!depositInstallment) {
      return {
        contract_id: contract.contract_id,
        client_id: contract.client_id,
        contract_marked_signed: !alreadySigned,
        deposit_invoice_created: false,
        deposit_invoice_id: null,
        payment_link: null,
        reason: 'no_deposit_installment',
      };
    }

    if (depositInstallment.qbo_invoice_id) {
      return {
        contract_id: contract.contract_id,
        client_id: contract.client_id,
        contract_marked_signed: !alreadySigned,
        deposit_invoice_created: false,
        deposit_invoice_id: depositInstallment.qbo_invoice_id,
        payment_link: null,
        reason: 'deposit_invoice_exists',
      };
    }

    if (
      !snapshot.deposit_paid &&
      snapshot.primary_portal_blocker === 'deposit_unpaid'
    ) {
      const amount = parseAmount(depositInstallment.amount);
      const dueDate =
        depositInstallment.due_date?.slice(0, 10) ||
        new Date().toISOString().slice(0, 10);
      const invoice = await createInvoiceService({
        userId: 'system-contract-signature',
        internalCustomerId: contract.client_id,
        dueDate,
        memo: `Contract deposit invoice for contract ${contract.contract_id}`,
        lineItems: [
          {
            DetailType: 'SalesItemLineDetail',
            Amount: amount,
            Description: `Contract deposit for ${contract.contract_id}`,
            SalesItemLineDetail: {
              ItemRef: { value: DEFAULT_SERVICE_ITEM_ID },
              UnitPrice: amount,
              Qty: 1,
            },
          },
        ],
      });

      const qboInvoiceId = invoice?.Id ? String(invoice.Id) : null;
      if (!qboInvoiceId) {
        throw new Error('QuickBooks did not return a deposit invoice id');
      }

      await queryCloudSql(
        `UPDATE public.payment_installments
         SET qbo_invoice_id = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [depositInstallment.id, qboInvoiceId]
      );

      return {
        contract_id: contract.contract_id,
        client_id: contract.client_id,
        contract_marked_signed: !alreadySigned,
        deposit_invoice_created: true,
        deposit_invoice_id: qboInvoiceId,
        payment_link: invoice?.invoiceLink ? String(invoice.invoiceLink) : null,
      };
    }

    return {
      contract_id: contract.contract_id,
      client_id: contract.client_id,
      contract_marked_signed: !alreadySigned,
      deposit_invoice_created: false,
      deposit_invoice_id: null,
      payment_link: null,
      reason: 'deposit_not_required_or_already_paid',
    };
  }
}

export const contractSignatureCompletionService =
  new ContractSignatureCompletionService();
