import supabase from '../supabase';

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
    console.log('📅 Creating payment schedule for contract:', request.contract_id);

    const { data, error } = await supabase.rpc('create_payment_schedule', {
      p_contract_id: request.contract_id,
      p_schedule_name: request.schedule_name,
      p_total_amount: request.total_amount,
      p_deposit_amount: request.deposit_amount || 0,
      p_number_of_installments: request.number_of_installments || 0,
      p_payment_frequency: request.payment_frequency || 'one-time',
      p_start_date: request.start_date || new Date().toISOString().split('T')[0]
    });

    if (error) {
      console.error('❌ Error creating payment schedule:', error);
      throw new Error(`Failed to create payment schedule: ${error.message}`);
    }

    console.log('✅ Payment schedule created successfully:', data);
    return data;
  }

  /**
   * Get payment summary for a contract
   */
  async getPaymentSummary(contractId: string): Promise<PaymentSummary> {
    console.log('💰 Getting payment summary for contract:', contractId);

    const { data, error } = await supabase.rpc('get_contract_payment_summary', {
      p_contract_id: contractId
    });

    if (error) {
      console.error('❌ Error getting payment summary:', error);
      throw new Error(`Failed to get payment summary: ${error.message}`);
    }

    return data[0] as PaymentSummary;
  }

  /**
   * Get all overdue payments
   */
  async getOverduePayments(): Promise<OverduePayment[]> {
    console.log('⚠️ Getting overdue payments');

    const { data, error } = await supabase.rpc('get_overdue_payments');

    if (error) {
      console.error('❌ Error getting overdue payments:', error);
      throw new Error(`Failed to get overdue payments: ${error.message}`);
    }

    return data as OverduePayment[];
  }

  /**
   * Get payment dashboard data
   */
  async getPaymentDashboard(): Promise<any[]> {
    console.log('📊 Getting payment dashboard data');

    const { data, error } = await supabase
      .from('payment_dashboard')
      .select('*')
      .order('next_payment_due', { ascending: true });

    if (error) {
      console.error('❌ Error getting payment dashboard:', error);
      throw new Error(`Failed to get payment dashboard: ${error.message}`);
    }

    return data;
  }

  /**
   * Get payment schedule for a contract
   */
  async getPaymentSchedule(contractId: string): Promise<PaymentSchedule[]> {
    console.log('📅 Getting payment schedule for contract:', contractId);

    const { data, error } = await supabase
      .from('payment_schedules')
      .select('*')
      .eq('contract_id', contractId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error getting payment schedule:', error);
      throw new Error(`Failed to get payment schedule: ${error.message}`);
    }

    return data as PaymentSchedule[];
  }

  /**
   * Get all payments for a contract (payment history)
   */
  async getContractPayments(contractId: string): Promise<PaymentRecord[]> {
    console.log('💳 Getting payment history for contract:', contractId);

    const { data, error } = await supabase
      .from('contract_payments')
      .select('*')
      .eq('contract_id', contractId)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('❌ Error getting contract payments:', error);
      throw new Error(`Failed to get contract payments: ${error.message}`);
    }

    return data as PaymentRecord[];
  }

  /**
   * Update payment status (when payment is processed)
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentRecord['status'],
    stripePaymentIntentId?: string,
    notes?: string
  ): Promise<PaymentRecord> {
    console.log('🔄 Updating payment status:', paymentId, 'to', status);

    const updateData: any = {
      status
    };

    if (stripePaymentIntentId) {
      updateData.stripe_payment_intent_id = stripePaymentIntentId;
    }

    if (notes) {
      updateData.notes = notes;
    }

    // Set appropriate timestamp based on status
    switch (status) {
      case 'succeeded':
        updateData.completed_at = new Date().toISOString();
        updateData.is_overdue = false; // Clear overdue flag when paid
        break;
      case 'failed':
        updateData.failed_at = new Date().toISOString();
        break;
      case 'refunded':
        updateData.refunded_at = new Date().toISOString();
        break;
    }

    const { data, error } = await supabase
      .from('contract_payments')
      .update(updateData)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating payment status:', error);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    console.log('✅ Payment status updated successfully');
    return data as PaymentRecord;
  }

  /**
   * Update overdue flags (can be called daily via cron job)
   */
  async updateOverdueFlags(): Promise<void> {
    console.log('🔄 Updating overdue payment flags');

    const { error } = await supabase.rpc('update_overdue_flags');

    if (error) {
      console.error('❌ Error updating overdue flags:', error);
      throw new Error(`Failed to update overdue flags: ${error.message}`);
    }

    console.log('✅ Overdue flags updated successfully');
  }

  /**
   * Run daily payment maintenance (updates overdue flags and schedule statuses)
   */
  async runDailyMaintenance(): Promise<void> {
    console.log('🔧 Running daily payment maintenance');

    const { error } = await supabase.rpc('daily_payment_maintenance');

    if (error) {
      console.error('❌ Error running daily maintenance:', error);
      throw new Error(`Failed to run daily maintenance: ${error.message}`);
    }

    console.log('✅ Daily payment maintenance completed');
  }

  /**
   * Get payments by status
   */
  async getPaymentsByStatus(status: PaymentRecord['status']): Promise<PaymentRecord[]> {
    console.log('💳 Getting payments by status:', status);

    const { data, error } = await supabase
      .from('contract_payments')
      .select(`
        *,
        contracts!inner (
          client_id,
          client_info!inner (
            first_name,
            last_name,
            email
          )
        )
      `)
      .eq('status', status)
      .order('due_date', { ascending: true });

    if (error) {
      console.error('❌ Error getting payments by status:', error);
      throw new Error(`Failed to get payments by status: ${error.message}`);
    }

    return data as PaymentRecord[];
  }

  /**
   * Get payments due within a date range
   */
  async getPaymentsDueBetween(startDate: string, endDate: string): Promise<PaymentRecord[]> {
    console.log('📅 Getting payments due between:', startDate, 'and', endDate);

    const { data, error } = await supabase
      .from('contract_payments')
      .select(`
        *,
        contracts!inner (
          client_id,
          client_info!inner (
            first_name,
            last_name,
            email
          )
        )
      `)
      .gte('due_date', startDate)
      .lte('due_date', endDate)
      .in('status', ['pending', 'failed'])
      .order('due_date', { ascending: true });

    if (error) {
      console.error('❌ Error getting payments due between dates:', error);
      throw new Error(`Failed to get payments due between dates: ${error.message}`);
    }

    return data as PaymentRecord[];
  }
}
