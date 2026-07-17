/** Authoritative Cloud SQL payment schedule service for CRM installments. */
import { PoolClient } from 'pg';

import { getPool } from '../db/cloudSqlPool';

export type PaymentFrequency = 'weekly' | 'biweekly' | 'bi-weekly' | 'monthly';

export interface CreatePaymentScheduleParams {
  contractId: string;
  scheduleName: string;
  totalAmount: string | number;
  depositAmount?: string | number;
  /** Number of post-deposit payments. The deposit is never included. */
  numberOfInstallments?: number;
  paymentFrequency?: PaymentFrequency;
  startDate: Date | string;
}

type ContractRow = {
  id: string;
  client_id: string;
  contract_json: Record<string, unknown>;
};

export class PaymentScheduleValidationError extends Error {}

function moneyToCents(value: string | number, field: string): number {
  const normalized =
    typeof value === 'string' ? value.trim().replace(/[$,]/g, '') : value;
  if (normalized === '' || !/^-?\d+(\.\d{1,2})?$/.test(String(normalized))) {
    throw new PaymentScheduleValidationError(
      `${field} must be a valid amount with at most two decimal places`
    );
  }
  const amount = Number(normalized);
  if (!Number.isSafeInteger(Math.round(amount * 100)) || amount < 0) {
    throw new PaymentScheduleValidationError(
      `${field} must be a non-negative monetary amount`
    );
  }
  return Math.round(amount * 100);
}

function cents(centsValue: number): string {
  return (centsValue / 100).toFixed(2);
}

function parseDate(value: Date | string): {
  year: number;
  month: number;
  day: number;
  iso: string;
} {
  const raw =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match)
    throw new PaymentScheduleValidationError(
      'startDate must be a valid ISO date'
    );
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new PaymentScheduleValidationError(
      'startDate must be a valid ISO date'
    );
  }
  return { year, month, day, iso: raw };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function installmentDueDate(
  start: Date | string,
  frequency: PaymentFrequency,
  offset: number
): string {
  const base = parseDate(start);
  const normalized = frequency === 'bi-weekly' ? 'biweekly' : frequency;
  if (normalized === 'weekly' || normalized === 'biweekly') {
    const date = new Date(Date.UTC(base.year, base.month - 1, base.day));
    date.setUTCDate(
      date.getUTCDate() + offset * (normalized === 'weekly' ? 7 : 14)
    );
    return date.toISOString().slice(0, 10);
  }
  const absoluteMonth = base.month - 1 + offset;
  const year = base.year + Math.floor(absoluteMonth / 12);
  const monthIndex = ((absoluteMonth % 12) + 12) % 12;
  // Anchor every calculation to the original day. Jan 31 => Feb 28/29 => Mar 31.
  const day = Math.min(base.day, daysInMonth(year, monthIndex + 1));
  return `${year.toString().padStart(4, '0')}-${(monthIndex + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

function contractTotalCents(row: ContractRow): number | null {
  for (const key of ['total_amount', 'total_investment', 'fee']) {
    const value = row.contract_json[key];
    if (value != null && String(value).trim() !== '')
      return moneyToCents(String(value), `contract.${key}`);
  }
  return null;
}

async function findExisting(
  client: PoolClient,
  contractId: string
): Promise<string | null> {
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM public.payment_schedules
     WHERE contract_id = $1 AND status IN ('draft', 'active')
     ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, created_at ASC LIMIT 1`,
    [contractId]
  );
  return rows[0]?.id ?? null;
}

export async function createPaymentScheduleInCloudSql(
  params: CreatePaymentScheduleParams
): Promise<string> {
  const totalCents = moneyToCents(params.totalAmount, 'totalAmount');
  const depositCents = moneyToCents(params.depositAmount ?? 0, 'depositAmount');
  const count = params.numberOfInstallments ?? 3;
  const frequency = params.paymentFrequency ?? 'monthly';
  const start = parseDate(params.startDate);
  if (!params.contractId || !params.scheduleName?.trim())
    throw new PaymentScheduleValidationError(
      'contractId and scheduleName are required'
    );
  if (!Number.isInteger(count) || count <= 0)
    throw new PaymentScheduleValidationError(
      'numberOfInstallments must be a positive integer and excludes the deposit'
    );
  if (!['weekly', 'biweekly', 'bi-weekly', 'monthly'].includes(frequency))
    throw new PaymentScheduleValidationError(
      `Unsupported payment frequency: ${frequency}`
    );
  if (totalCents <= 0)
    throw new PaymentScheduleValidationError(
      'totalAmount must be greater than zero'
    );
  if (depositCents > totalCents)
    throw new PaymentScheduleValidationError(
      'depositAmount cannot exceed totalAmount'
    );
  const remaining = totalCents - depositCents;
  if (remaining <= 0)
    throw new PaymentScheduleValidationError(
      'numberOfInstallments requires an amount remaining after the deposit'
    );

  const db = await getPool().connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `payment-schedule:${params.contractId}`,
    ]);
    const contractResult = await db.query<ContractRow>(
      `SELECT id, client_id, to_jsonb(pc) AS contract_json FROM public.phi_contracts pc WHERE id = $1 FOR UPDATE`,
      [params.contractId]
    );
    const contract = contractResult.rows[0];
    if (!contract?.client_id)
      throw new PaymentScheduleValidationError(
        `Contract not found or has no client: ${params.contractId}`
      );
    const authoritativeTotal = contractTotalCents(contract);
    if (authoritativeTotal != null && authoritativeTotal !== totalCents) {
      throw new PaymentScheduleValidationError(
        'Schedule total does not match the contract total'
      );
    }
    const existing = await findExisting(db, params.contractId);
    if (existing) {
      await db.query('COMMIT');
      return existing;
    }

    const base = Math.floor(remaining / count);
    const remainder = remaining - base * count;
    const totalPayments = count + (depositCents > 0 ? 1 : 0);
    const finalDueDate = installmentDueDate(
      start.iso,
      frequency,
      count - 1 + (depositCents > 0 ? 1 : 0)
    );
    const schedule = await db.query<{ id: string }>(
      `INSERT INTO public.payment_schedules
       (contract_id, schedule_name, total_amount, deposit_amount, installment_amount,
        number_of_installments, payment_frequency, start_date, end_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,$9::date,'active') RETURNING id`,
      [
        params.contractId,
        params.scheduleName.trim(),
        cents(totalCents),
        cents(depositCents),
        cents(base),
        count,
        frequency === 'bi-weekly' ? 'biweekly' : frequency,
        start.iso,
        finalDueDate,
      ]
    );
    const scheduleId = schedule.rows[0]?.id;
    if (!scheduleId) throw new Error('Failed to create payment schedule');

    let paymentNumber = 1;
    if (depositCents > 0) {
      await db.query(
        `INSERT INTO public.payment_installments
         (schedule_id, amount, due_date, status, payment_type, payment_number, total_payments, is_overdue)
         VALUES ($1,$2,$3::date,'pending','deposit',$4,$5,FALSE)`,
        [
          scheduleId,
          cents(depositCents),
          start.iso,
          paymentNumber++,
          totalPayments,
        ]
      );
    }
    for (let i = 0; i < count; i += 1) {
      const isLast = i === count - 1;
      const amount = base + (isLast ? remainder : 0);
      await db.query(
        `INSERT INTO public.payment_installments
         (schedule_id, amount, due_date, status, payment_type, payment_number, total_payments, is_overdue)
         VALUES ($1,$2,$3::date,'pending',$4,$5,$6,FALSE)`,
        [
          scheduleId,
          cents(amount),
          installmentDueDate(
            start.iso,
            frequency,
            i + (depositCents > 0 ? 1 : 0)
          ),
          isLast && remainder > 0 ? 'final' : 'installment',
          paymentNumber++,
          totalPayments,
        ]
      );
    }
    await db.query('COMMIT');
    return scheduleId;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    db.release();
  }
}
