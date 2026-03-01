/**
 * Cloud SQL payment schedule service - creates payment plans for Labor Support contracts.
 * Replaces Supabase create_payment_schedule RPC.
 */

import { getPool } from '../db/cloudSqlPool';

export interface CreatePaymentScheduleParams {
  contractId: string;
  scheduleName: string;
  totalAmount: number;
  depositAmount?: number;
  numberOfInstallments?: number;
  paymentFrequency?: string;
  startDate: Date;
}

export async function createPaymentScheduleInCloudSql(
  params: CreatePaymentScheduleParams
): Promise<string> {
  const {
    contractId,
    scheduleName,
    totalAmount,
    depositAmount = 0,
    numberOfInstallments = 3,
    paymentFrequency = 'monthly',
    startDate,
  } = params;

  const pool = getPool();
  const remaining = Math.max(0, totalAmount - depositAmount);
  const installmentAmount =
    numberOfInstallments > 0 ? remaining / numberOfInstallments : remaining;
  const startDateStr = startDate instanceof Date ? startDate.toISOString().split('T')[0] : String(startDate).split('T')[0];

  // Insert payment schedule
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + numberOfInstallments + 1);
  const endDateStr = endDate.toISOString().split('T')[0];

  const { rows: scheduleRows } = await pool.query<{ id: string }>(
    `INSERT INTO payment_schedules (
      contract_id, schedule_name, total_amount, deposit_amount,
      installment_amount, number_of_installments, payment_frequency,
      start_date, end_date, status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, 'active')
    RETURNING id`,
    [
      contractId,
      scheduleName,
      totalAmount,
      depositAmount,
      installmentAmount,
      numberOfInstallments,
      paymentFrequency,
      startDateStr,
      endDateStr,
    ]
  );

  const scheduleId = scheduleRows[0]?.id;
  if (!scheduleId) throw new Error('Failed to create payment schedule');

  const totalPayments = depositAmount > 0 ? numberOfInstallments + 1 : numberOfInstallments;
  let paymentNumber = 1;

  // Insert deposit payment if any
  if (depositAmount > 0) {
    await pool.query(
      `INSERT INTO payment_installments (
        schedule_id, amount, due_date, status, payment_type,
        payment_number, total_payments, is_overdue
      ) VALUES ($1, $2, $3::date, 'pending', 'deposit', 1, $4, FALSE)`,
      [scheduleId, depositAmount, startDateStr, totalPayments]
    );
    paymentNumber = 2;
  }

  // Insert installment payments
  for (let i = 0; i < numberOfInstallments; i++) {
    const dueDate = new Date(startDate);
    dueDate.setMonth(dueDate.getMonth() + i + (depositAmount > 0 ? 1 : 0));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    await pool.query(
      `INSERT INTO payment_installments (
        schedule_id, amount, due_date, status, payment_type,
        payment_number, total_payments, is_overdue
      ) VALUES ($1, $2, $3::date, 'pending', 'installment', $4, $5, FALSE)`,
      [scheduleId, Math.round(installmentAmount * 100) / 100, dueDateStr, paymentNumber + i, totalPayments]
    );
  }

  return scheduleId;
}
