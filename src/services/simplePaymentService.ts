import { getPool } from '../db/cloudSqlPool';
import { createPaymentScheduleInCloudSql } from './cloudSqlPaymentScheduleService';

export interface PaymentSchedule {
  id: string;
  contract_id: string;
  schedule_name: string;
  total_amount: number;
  deposit_amount: number;
  installment_amount: number;
  number_of_installments: number;
  payment_frequency: 'one-time' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  start_date: string;
  end_date?: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  contract_id: string;
  payment_schedule_id?: string;
  payment_type: 'deposit' | 'installment' | 'final';
  amount: number;
  due_date?: string;
  payment_number: number;
  total_payments: number;
  stripe_payment_intent_id?: string;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled' | 'refunded';
  is_overdue: boolean;
  notes?: string;
  created_at: string;
  completed_at?: string;
  failed_at?: string;
  refunded_at?: string;
}

export interface PaymentSummary {
  total_amount: number;
  total_paid: number;
  total_due: number;
  overdue_amount: number;
  next_payment_due?: string;
  next_payment_amount?: number;
  payment_count: number;
  overdue_count: number;
}

export interface OverduePayment {
  payment_id: string;
  contract_id: string;
  client_name: string;
  client_email: string;
  payment_type: string;
  amount: number;
  due_date: string;
  days_overdue: number;
  payment_schedule_name?: string;
}

export interface CreatePaymentScheduleRequest {
  contract_id: string;
  schedule_name: string;
  total_amount: number;
  deposit_amount?: number;
  number_of_installments?: number;
  payment_frequency?: 'one-time' | 'weekly' | 'bi-weekly' | 'monthly' | 'quarterly';
  start_date?: string;
}

export class SimplePaymentService {
  /**
   * Create a payment schedule for a contract (called when admin creates contract)
   */
  async createPaymentSchedule(request: CreatePaymentScheduleRequest): Promise<string> {
    if (!request.number_of_installments) {
      throw new Error('A positive number_of_installments is required');
    }
    return createPaymentScheduleInCloudSql({
      contractId: request.contract_id,
      scheduleName: request.schedule_name,
      totalAmount: request.total_amount,
      depositAmount: request.deposit_amount ?? 0,
      numberOfInstallments: request.number_of_installments,
      paymentFrequency: request.payment_frequency === 'bi-weekly' ? 'biweekly' : request.payment_frequency as any,
      startDate: request.start_date || new Date().toISOString().slice(0, 10),
    });
  }

  /**
   * Get payment summary for a contract (Cloud SQL payment_schedules + payment_installments)
   */
  async getPaymentSummary(contractId: string): Promise<PaymentSummary> {
    console.log('💰 Getting payment summary for contract:', contractId);

    try {
      const pool = getPool();

      const { rows: scheduleRows } = await pool.query<{ id: string; total_amount: string }>(
        'SELECT id, total_amount FROM payment_schedules WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 1',
        [contractId]
      );

      if (scheduleRows.length === 0) {
        throw new Error(`Payment schedule not found for contract ${contractId}`);
      }

      const schedule = scheduleRows[0];
      const totalAmount = parseFloat(schedule.total_amount);

      const { rows: installments } = await pool.query<{
        id: string;
        amount: string;
        due_date: string | null;
        status: string | null;
      }>(
        'SELECT id, amount, due_date, status FROM payment_installments WHERE schedule_id = $1 ORDER BY due_date ASC NULLS LAST',
        [schedule.id]
      );

      const isPaid = (s: string | null) =>
        s === 'succeeded' || s === 'completed' || s === 'paid';
      const totalPaid = installments
        .filter(inst => isPaid(inst.status))
        .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
      const totalDue = totalAmount - totalPaid;

      const nextPayment = installments.find(inst => !isPaid(inst.status));
      const overduePayments = installments.filter(
        inst =>
          !isPaid(inst.status) &&
          inst.due_date &&
          new Date(inst.due_date) < new Date()
      );

      const summary: PaymentSummary = {
        total_amount: totalAmount,
        total_paid: totalPaid,
        total_due: totalDue,
        overdue_amount: overduePayments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0),
        next_payment_due: nextPayment?.due_date ?? undefined,
        next_payment_amount: nextPayment ? parseFloat(nextPayment.amount) : 0,
        payment_count: installments.length,
        overdue_count: overduePayments.length
      };

      console.log('✅ Payment summary calculated:', summary);
      return summary;
    } catch (error) {
      console.error('❌ Error getting payment summary:', error);
      throw new Error(`Failed to get payment summary: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get all overdue payments
   */
  async getOverduePayments(): Promise<OverduePayment[]> {
    const { rows } = await getPool().query<OverduePayment>(
      `SELECT pi.id AS payment_id, ps.contract_id, c.first_name||' '||c.last_name AS client_name,
       c.email AS client_email, pi.payment_type, pi.amount, pi.due_date::text,
       (CURRENT_DATE-pi.due_date) AS days_overdue, ps.schedule_name AS payment_schedule_name
       FROM public.payment_installments pi JOIN public.payment_schedules ps ON ps.id=pi.schedule_id
       JOIN public.phi_contracts pc ON pc.id=ps.contract_id JOIN public.phi_clients c ON c.id=pc.client_id
       WHERE pi.due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
       AND pi.status NOT IN ('paid','completed','succeeded','cancelled','canceled')
       ORDER BY pi.due_date,pi.payment_number,pi.created_at`
    );
    return rows;
  }

  /**
   * Get payment dashboard data
   */
  async getPaymentDashboard(): Promise<any[]> {
    const { rows } = await getPool().query(
      `SELECT ps.*, min(pi.due_date) FILTER (WHERE pi.status NOT IN ('paid','cancelled')) AS next_payment_due,
       COALESCE(sum(pi.amount) FILTER (WHERE pi.status='paid'),0) AS total_paid
       FROM public.payment_schedules ps LEFT JOIN public.payment_installments pi ON pi.schedule_id=ps.id
       GROUP BY ps.id ORDER BY next_payment_due ASC NULLS LAST`
    );
    return rows;
  }

  /**
   * Get payment schedule for a contract
   */
  async getPaymentSchedule(contractId: string): Promise<PaymentSchedule[]> {
    console.log('📅 Getting payment schedule for contract:', contractId);

    const { rows } = await getPool().query<PaymentSchedule>(
      'SELECT * FROM public.payment_schedules WHERE contract_id=$1 ORDER BY created_at DESC',
      [contractId]
    );
    return rows;
  }

  /**
   * Get all payments for a contract (payment history)
   */
  async getContractPayments(contractId: string, clientId?: string): Promise<PaymentRecord[]> {
    console.log('💳 Getting payment history for contract:', contractId);
    type CloudSqlPaymentHistoryRow = {
      id: number;
      contract_id: string | null;
      amount: string;
      method: string | null;
      txn_date: Date | null;
    };

    try {
      const query = clientId
        ? `
          SELECT id, contract_id, amount, method, txn_date
          FROM public.payments
          WHERE contract_id = $1 AND client_id = $2
          ORDER BY txn_date ASC NULLS LAST, id ASC
        `
        : `
          SELECT id, contract_id, amount, method, txn_date
          FROM public.payments
          WHERE contract_id = $1
          ORDER BY txn_date ASC NULLS LAST, id ASC
        `;
      const values = clientId ? [contractId, clientId] : [contractId];
      const { rows } = await getPool().query<CloudSqlPaymentHistoryRow>(query, values);

      return rows.map((row): PaymentRecord => {
        const normalizedType = ((row.method || '').toLowerCase().includes('deposit')
          ? 'deposit'
          : (row.method || '').toLowerCase().includes('final')
            ? 'final'
            : 'installment') as PaymentRecord['payment_type'];

        return {
          id: String(row.id),
          contract_id: row.contract_id || contractId,
          payment_type: normalizedType,
          amount: Number(row.amount),
          payment_number: 1,
          total_payments: 1,
          status: 'succeeded',
          is_overdue: false,
          created_at: row.txn_date ? new Date(row.txn_date).toISOString() : new Date(0).toISOString(),
        };
      });
    } catch (error) {
      const msg = (error as Error)?.message || '';
      if (msg.includes('contract_id') && msg.includes('does not exist')) {
        return [];
      }
      console.error('❌ Error getting contract payments from Cloud SQL:', error);
      throw new Error(`Failed to get contract payments: ${msg}`);
    }
  }

  /**
   * Update authoritative Cloud SQL installment status.
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentRecord['status'],
    stripePaymentIntentId?: string,
    notes?: string
  ): Promise<PaymentRecord> {
    console.log('🔄 Updating payment status:', paymentId, 'to', status);

    const normalized = status === 'succeeded' ? 'paid' : status === 'canceled' ? 'cancelled' : status;
    const pool = getPool();
    const { rows } = await pool.query<PaymentRecord>(
      `UPDATE public.payment_installments SET status=$1,
       stripe_payment_intent_id=COALESCE($2,stripe_payment_intent_id), notes=COALESCE($3,notes),
       paid_at=CASE WHEN $1='paid' THEN COALESCE(paid_at,CURRENT_TIMESTAMP) ELSE paid_at END,
       failed_at=CASE WHEN $1='failed' THEN COALESCE(failed_at,CURRENT_TIMESTAMP) ELSE failed_at END,
       cancelled_at=CASE WHEN $1='cancelled' THEN COALESCE(cancelled_at,CURRENT_TIMESTAMP) ELSE cancelled_at END,
       is_overdue=CASE WHEN $1 IN ('paid','cancelled') THEN FALSE ELSE is_overdue END,
       updated_at=CURRENT_TIMESTAMP WHERE id=$4 RETURNING *`,
      [normalized, stripePaymentIntentId ?? null, notes ?? null, paymentId]
    );
    if (!rows[0]) throw new Error(`Payment installment not found: ${paymentId}`);
    return rows[0];
  }

  /**
   * Update overdue flags (can be called daily via cron job)
   */
  async updateOverdueFlags(): Promise<void> {
    await getPool().query(
      `UPDATE public.payment_installments SET
       is_overdue=(due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
         AND status NOT IN ('paid','completed','succeeded','cancelled','canceled')),
       status=CASE WHEN due_date < (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date
         AND status IN ('upcoming','pending') THEN 'overdue' ELSE status END,
       updated_at=CURRENT_TIMESTAMP`
    );
  }

  /**
   * Run daily payment maintenance (updates overdue flags and schedule statuses)
   */
  async runDailyMaintenance(): Promise<void> {
    console.log('🔧 Running daily payment maintenance');

    await this.updateOverdueFlags();
    await getPool().query(
      `UPDATE public.payment_schedules ps SET status='completed',updated_at=CURRENT_TIMESTAMP
       WHERE status='active' AND EXISTS (SELECT 1 FROM public.payment_installments pi WHERE pi.schedule_id=ps.id)
       AND NOT EXISTS (SELECT 1 FROM public.payment_installments pi WHERE pi.schedule_id=ps.id AND pi.status NOT IN ('paid','completed','succeeded','cancelled','canceled'))`
    );
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status: PaymentRecord['status']): Promise<PaymentRecord[]> {
    console.log('💳 Getting payments by status:', status);

    const normalized = status === 'succeeded' ? 'paid' : status === 'canceled' ? 'cancelled' : status;
    const { rows } = await getPool().query<PaymentRecord>(
      `SELECT pi.*,ps.contract_id FROM public.payment_installments pi
       JOIN public.payment_schedules ps ON ps.id=pi.schedule_id WHERE pi.status=$1
       ORDER BY pi.due_date,pi.payment_number,pi.created_at`, [normalized]
    );
    return rows;
  }

  /**
   * Get payments due within a date range
   */
  async getPaymentsDueBetween(startDate: string, endDate: string): Promise<PaymentRecord[]> {
    console.log('📅 Getting payments due between:', startDate, 'and', endDate);

    const { rows } = await getPool().query<PaymentRecord>(
      `SELECT pi.*,ps.contract_id FROM public.payment_installments pi
       JOIN public.payment_schedules ps ON ps.id=pi.schedule_id
       WHERE pi.due_date BETWEEN $1::date AND $2::date AND pi.status IN ('upcoming','pending','overdue','failed')
       ORDER BY pi.due_date,pi.payment_number,pi.created_at`, [startDate,endDate]
    );
    return rows;
  }
}
