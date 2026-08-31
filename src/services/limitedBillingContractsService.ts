import { queryCloudSql } from '../db/cloudSqlPool';
import { getLimitedBillingViewUrl } from '../utils/billingViewUrl';

export interface LimitedContractBillingSummary {
  contractId: string;
  clientName: string;
  clientEmail?: string | null;
  contractType: string;
  contractStatus: string;
  totalAmount: number;
  installmentCount?: number | null;
  paymentSchedule?: string | null;
  nextDueDate?: string | null;
  billingResponsibility?: string | null;
  paymentMethodSummary?: string | null;
  insuranceCoverageType?: string | null;
  deductiblePaymentMethod?: string | null;
  paymentIssueType?: string | null;
  paymentIssueSummary?: string | null;
  invoiceStatus?: string | null;
  quickBooksSyncStatus?: string | null;
  limitedViewUrl?: string | null;
}

export interface LimitedContractInstallment {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: string;
  paidDate?: string | null;
  invoiceId?: string | null;
  invoiceStatus?: string | null;
  paymentIssueType?: string | null;
  paymentIssueSummary?: string | null;
}

export interface LimitedContractPaymentSchedule {
  contractId: string;
  clientName: string;
  clientEmail?: string | null;
  contractType: string;
  contractStatus: string;
  totalAmount: number;
  depositAmount?: number | null;
  installmentCount?: number | null;
  paymentSchedule?: string | null;
  billingResponsibility?: string | null;
  paymentMethodSummary?: string | null;
  insuranceCoverageType?: string | null;
  deductiblePaymentMethod?: string | null;
  paymentIssueType?: string | null;
  paymentIssueSummary?: string | null;
  installments: LimitedContractInstallment[];
  invoiceStatus?: string | null;
  quickBooksSyncStatus?: string | null;
  createdAt?: string | null;
  sentAt?: string | null;
  signedAt?: string | null;
  limitedViewUrl?: string | null;
}

type BaseContractRow = {
  contract_id: string;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  contract_type: string | null;
  contract_status: string | null;
  total_amount: string | number | null;
  deposit_amount: string | number | null;
  payment_schedule: string | null;
  installment_count: number | null;
  next_due_date: string | null;
  payment_method: string | null;
  insurance: string | null;
  insurance_provider: string | null;
  insurance_plan_type: string | null;
  self_pay_card_info: string | null;
  invoice_status: string | null;
  qbo_invoice_id: string | null;
  created_at: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signing_provider: string | null;
};

type InstallmentRow = {
  payment_number: number | null;
  due_date: string | Date | null;
  amount: string | number | null;
  status: string | null;
  paid_date: string | Date | null;
  invoice_id?: string | null;
  invoice_status?: string | null;
};

function parseAmount(value: string | number | null | undefined): number {
  if (value == null || value === '') return 0;
  const n = Number(String(value).replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
}

function toIsoDate(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const trimmed = String(value).trim();
  return trimmed || null;
}

function toIsoDay(value: string | Date | null | undefined): string | null {
  const iso = toIsoDate(value);
  return iso ? iso.slice(0, 10) : null;
}

function inferQuickBooksSyncStatus(qboInvoiceId: string | null): string | null {
  return qboInvoiceId ? 'synced' : null;
}

function humanizeLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveBillingResponsibility(row: BaseContractRow): string | null {
  if (row.insurance_provider || row.insurance || row.insurance_plan_type) {
    return 'Insurance / Client';
  }
  if (row.payment_method || row.self_pay_card_info) {
    return 'Client';
  }
  return null;
}

function derivePaymentMethodSummary(row: BaseContractRow): string | null {
  return (
    humanizeLabel(row.payment_method) ??
    (row.self_pay_card_info ? 'Card on file' : null)
  );
}

function deriveInsuranceCoverageType(row: BaseContractRow): string | null {
  return (
    humanizeLabel(row.insurance_plan_type) ??
    humanizeLabel(row.insurance_provider) ??
    humanizeLabel(row.insurance)
  );
}

function deriveDeductiblePaymentMethod(row: BaseContractRow): string | null {
  if (!(row.insurance_provider || row.insurance || row.insurance_plan_type))
    return null;
  return derivePaymentMethodSummary(row);
}

function inferInstallmentIssue(installment: {
  status: string;
  dueDate: string | null;
  amount: number;
}): { paymentIssueType: string | null; paymentIssueSummary: string | null } {
  const normalizedStatus = String(installment.status || '')
    .trim()
    .toLowerCase();
  const dueDate = installment.dueDate ? new Date(installment.dueDate) : null;
  const isPastDue =
    dueDate != null &&
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < Date.now();

  if (normalizedStatus === 'failed') {
    return {
      paymentIssueType: 'card_declined',
      paymentIssueSummary:
        'A scheduled payment attempt failed and needs follow-up.',
    };
  }
  if (
    normalizedStatus === 'overdue' ||
    (normalizedStatus === 'pending' && isPastDue)
  ) {
    return {
      paymentIssueType: 'past_due',
      paymentIssueSummary: `Payment of ${installment.amount.toFixed(2)} is past due.`,
    };
  }
  return {
    paymentIssueType: null,
    paymentIssueSummary: null,
  };
}

function inferContractIssue(installments: LimitedContractInstallment[]): {
  paymentIssueType: string | null;
  paymentIssueSummary: string | null;
} {
  for (const installment of installments) {
    if (installment.paymentIssueType || installment.paymentIssueSummary) {
      return {
        paymentIssueType: installment.paymentIssueType ?? null,
        paymentIssueSummary: installment.paymentIssueSummary ?? null,
      };
    }
  }
  return { paymentIssueType: null, paymentIssueSummary: null };
}

function inferSummaryIssue(row: BaseContractRow): {
  paymentIssueType: string | null;
  paymentIssueSummary: string | null;
} {
  const invoiceStatus = String(row.invoice_status || '')
    .trim()
    .toLowerCase();
  if (invoiceStatus === 'failed') {
    return {
      paymentIssueType: 'card_declined',
      paymentIssueSummary:
        'The latest invoice/payment record shows a failed payment status.',
    };
  }

  if (row.next_due_date) {
    const dueDate = new Date(row.next_due_date);
    if (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() < Date.now()) {
      return {
        paymentIssueType: 'past_due',
        paymentIssueSummary:
          'A scheduled payment due date has passed and needs follow-up.',
      };
    }
  }

  return {
    paymentIssueType: null,
    paymentIssueSummary: null,
  };
}

async function queryBaseContracts(
  contractId?: string,
  filters?: {
    status?: string;
    since?: string;
    signingProvider?: 'native' | 'legacy';
  }
): Promise<BaseContractRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIndex = 1;

  if (contractId) {
    conditions.push(`pc.id = $${paramIndex++}::uuid`);
    params.push(contractId);
  }
  if (filters?.status) {
    conditions.push(
      `LOWER(COALESCE(pc.status::text, '')) = LOWER($${paramIndex++})`
    );
    params.push(filters.status);
  }
  if (filters?.since) {
    conditions.push(
      `COALESCE(pc.created_at, pc.inserted_at)::date >= $${paramIndex++}::date`
    );
    params.push(filters.since);
  }
  if (filters?.signingProvider === 'native') {
    conditions.push(`pc.signing_provider = 'native'`);
  } else if (filters?.signingProvider === 'legacy') {
    conditions.push(`COALESCE(pc.signing_provider, '') <> 'native'`);
  }

  const contractFilterSql =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT
      pc.id AS contract_id,
      pc.client_id AS client_id,
      NULLIF(TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))), '') AS client_name,
      NULLIF(c.email, '') AS client_email,
      COALESCE(
        NULLIF(pc.field_snapshot->>'serviceType', ''),
        NULLIF(c.service_needed, ''),
        'Contract'
      ) AS contract_type,
      COALESCE(NULLIF(pc.status::text, ''), 'pending') AS contract_status,
      COALESCE(
        NULLIF(to_jsonb(ps)->>'total_amount', '')::numeric,
        CASE
          WHEN pc.signing_provider = 'native'
            AND pc.field_snapshot ? 'pricing'
          THEN (pc.field_snapshot->'pricing'->>'totalCents')::numeric / 100
          ELSE 0
        END,
        0
      )::text AS total_amount,
      NULLIF(to_jsonb(ps)->>'deposit_amount', '') AS deposit_amount,
      NULLIF(to_jsonb(ps)->>'schedule_name', '') AS payment_schedule,
      (
        SELECT COUNT(*)
        FROM public.payment_installments pi_count
        WHERE pi_count.schedule_id = ps.id
      )::int AS installment_count,
      (
        SELECT to_char(pi_next.due_date::date, 'YYYY-MM-DD')
        FROM public.payment_installments pi_next
        WHERE pi_next.schedule_id = ps.id
          AND COALESCE(pi_next.status, 'pending') NOT IN ('paid', 'succeeded', 'completed')
        ORDER BY pi_next.due_date ASC NULLS LAST, pi_next.payment_number ASC NULLS LAST
        LIMIT 1
      ) AS next_due_date,
      NULLIF(c.payment_method, '') AS payment_method,
      NULLIF(c.insurance, '') AS insurance,
      NULLIF(c.insurance_provider, '') AS insurance_provider,
      NULLIF(c.insurance_plan_type, '') AS insurance_plan_type,
      NULLIF(c.self_pay_card_info, '') AS self_pay_card_info,
      NULLIF(to_jsonb(inv)->>'status', '') AS invoice_status,
      NULLIF(to_jsonb(inv)->>'qbo_invoice_id', '') AS qbo_invoice_id,
      COALESCE(
        NULLIF(to_jsonb(pc)->>'inserted_at', ''),
        NULLIF(to_jsonb(pc)->>'created_at', ''),
        to_char(pc.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      ) AS created_at,
      NULLIF(to_jsonb(csi)->>'sent_at', '') AS sent_at,
      COALESCE(
        NULLIF(to_jsonb(csi)->>'signed_at', ''),
        to_char(pc.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        CASE WHEN COALESCE(NULLIF(pc.status::text, ''), '') = 'signed'
          THEN COALESCE(
            to_char(pc.signed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
            NULLIF(to_jsonb(pc)->>'updated_at', ''),
            NULLIF(to_jsonb(pc)->>'inserted_at', ''),
            NULLIF(to_jsonb(pc)->>'created_at', ''),
            to_char(pc.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          )
          ELSE NULL
        END
      ) AS signed_at,
      pc.signing_provider AS signing_provider
    FROM public.phi_contracts pc
    LEFT JOIN public.phi_clients c ON c.id = pc.client_id
    LEFT JOIN public.payment_schedules ps ON ps.contract_id = pc.id
    LEFT JOIN LATERAL (
      SELECT *
      FROM public.phi_invoices inv
      WHERE inv.client_id = pc.client_id
      ORDER BY
        COALESCE(
          NULLIF(to_jsonb(inv)->>'created_at', ''),
          NULLIF(to_jsonb(inv)->>'updated_at', '')
        ) DESC NULLS LAST,
        NULLIF(to_jsonb(inv)->>'id', '') DESC NULLS LAST
      LIMIT 1
    ) inv ON TRUE
    LEFT JOIN public.contract_signnow_integration csi ON csi.contract_id = pc.id
    ${contractFilterSql}
    ORDER BY COALESCE(pc.signed_at, pc.created_at, pc.updated_at) DESC NULLS LAST, pc.id DESC
  `;

  try {
    const { rows } = await queryCloudSql<BaseContractRow>(sql, params);
    return rows;
  } catch (error) {
    const message = String((error as Error)?.message || '');
    if (
      message.includes('contract_signnow_integration') &&
      message.includes('does not exist')
    ) {
      const fallbackSql = sql
        .replace(
          'LEFT JOIN public.contract_signnow_integration csi ON csi.contract_id = pc.id',
          ''
        )
        .replace(
          /NULLIF\(to_jsonb\(csi\)->>'sent_at', ''\) AS sent_at,/,
          'NULL::text AS sent_at,'
        )
        .replace(
          /COALESCE\(\s*NULLIF\(to_jsonb\(csi\)->>'signed_at', ''\),[\s\S]*?\) AS signed_at/,
          `CASE WHEN COALESCE(NULLIF(to_jsonb(pc)->>'status', ''), '') = 'signed'
            THEN COALESCE(NULLIF(to_jsonb(pc)->>'updated_at', ''), NULLIF(to_jsonb(pc)->>'inserted_at', ''), NULLIF(to_jsonb(pc)->>'created_at', ''))
            ELSE NULL
          END AS signed_at`
        );
      const { rows } = await queryCloudSql<BaseContractRow>(
        fallbackSql,
        params
      );
      return rows;
    }
    if (
      message.includes('phi_contracts') &&
      (message.includes('does not exist') || message.includes('relation'))
    ) {
      return [];
    }
    throw error;
  }
}

async function queryInstallments(
  contractId: string
): Promise<LimitedContractInstallment[]> {
  const sql = `
    SELECT
      pi.payment_number,
      pi.due_date,
      pi.amount,
      COALESCE(pi.status, 'pending') AS status,
      NULLIF(to_jsonb(pi)->>'invoice_id', '') AS invoice_id,
      NULLIF(to_jsonb(inv)->>'status', '') AS invoice_status,
      CASE
        WHEN COALESCE(pi.status, '') IN ('paid', 'succeeded', 'completed') THEN to_char(pi.due_date::date, 'YYYY-MM-DD')
        ELSE NULL
      END AS paid_date
    FROM public.payment_installments pi
    JOIN public.payment_schedules ps ON ps.id = pi.schedule_id
    LEFT JOIN public.phi_invoices inv ON NULLIF(to_jsonb(pi)->>'invoice_id', '') = inv.id::text
    WHERE ps.contract_id = $1::uuid
    ORDER BY pi.payment_number ASC NULLS LAST, pi.due_date ASC NULLS LAST
  `;
  try {
    const { rows } = await queryCloudSql<InstallmentRow>(sql, [contractId]);
    return rows.map((row, index) => {
      const base = {
        installmentNumber: row.payment_number ?? index + 1,
        dueDate: toIsoDay(row.due_date) ?? '',
        amount: parseAmount(row.amount),
        status: row.status ?? 'pending',
        paidDate: toIsoDay(row.paid_date),
        invoiceId: row.invoice_id ?? null,
        invoiceStatus: row.invoice_status ?? null,
      };
      const issue = inferInstallmentIssue(base);
      return {
        ...base,
        ...issue,
      };
    });
  } catch (error) {
    const message = String((error as Error)?.message || '');
    if (
      message.includes('payment_installments') &&
      (message.includes('does not exist') || message.includes('relation'))
    ) {
      return [];
    }
    throw error;
  }
}

export interface LimitedBillingListFilters {
  status?: string;
  since?: string;
  signingProvider?: 'native' | 'legacy';
}

export async function listLimitedBillingContracts(
  filters?: LimitedBillingListFilters
): Promise<LimitedContractBillingSummary[]> {
  const rows = await queryBaseContracts(undefined, filters);
  return rows.map((row) => {
    const issue = inferSummaryIssue(row);
    return {
      contractId: row.contract_id,
      clientName: row.client_name || 'Unknown client',
      clientEmail: row.client_email ?? null,
      contractType: row.contract_type || 'Contract',
      contractStatus: row.contract_status || 'pending',
      totalAmount: parseAmount(row.total_amount),
      installmentCount: row.installment_count,
      paymentSchedule: row.payment_schedule,
      nextDueDate: row.next_due_date,
      billingResponsibility: deriveBillingResponsibility(row),
      paymentMethodSummary: derivePaymentMethodSummary(row),
      insuranceCoverageType: deriveInsuranceCoverageType(row),
      deductiblePaymentMethod: deriveDeductiblePaymentMethod(row),
      paymentIssueType: issue.paymentIssueType,
      paymentIssueSummary: issue.paymentIssueSummary,
      invoiceStatus: row.invoice_status,
      quickBooksSyncStatus: inferQuickBooksSyncStatus(row.qbo_invoice_id),
      limitedViewUrl: getLimitedBillingViewUrl(row.contract_id),
      createdAt: toIsoDate(row.created_at),
      signedAt: toIsoDate(row.signed_at),
      signingProvider: row.signing_provider === 'native' ? 'native' : 'legacy',
    };
  });
}

export async function getLimitedBillingContractById(
  contractId: string
): Promise<LimitedContractPaymentSchedule | null> {
  const rows = await queryBaseContracts(contractId);
  const row = rows[0];
  if (!row) return null;
  const installments = await queryInstallments(contractId);
  const issue = inferContractIssue(installments);
  return {
    contractId: row.contract_id,
    clientName: row.client_name || 'Unknown client',
    clientEmail: row.client_email ?? null,
    contractType: row.contract_type || 'Contract',
    contractStatus: row.contract_status || 'pending',
    totalAmount: parseAmount(row.total_amount),
    depositAmount:
      row.deposit_amount != null ? parseAmount(row.deposit_amount) : null,
    installmentCount: row.installment_count,
    paymentSchedule: row.payment_schedule,
    billingResponsibility: deriveBillingResponsibility(row),
    paymentMethodSummary: derivePaymentMethodSummary(row),
    insuranceCoverageType: deriveInsuranceCoverageType(row),
    deductiblePaymentMethod: deriveDeductiblePaymentMethod(row),
    paymentIssueType: issue.paymentIssueType,
    paymentIssueSummary: issue.paymentIssueSummary,
    installments,
    invoiceStatus: row.invoice_status,
    quickBooksSyncStatus: inferQuickBooksSyncStatus(row.qbo_invoice_id),
    createdAt: row.created_at,
    sentAt: row.sent_at,
    signedAt: row.signed_at,
    limitedViewUrl: getLimitedBillingViewUrl(row.contract_id),
  };
}
