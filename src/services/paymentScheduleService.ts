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
  notes?: string;
  created_at: string;
  completed_at?: string;
  failed_at?: string;
  refunded_at?: string;
  reminder_sent_at?: string;
  overdue_notice_sent_at?: string;
}

export interface PaymentReminder {
  id: string;
  payment_id: string;
  reminder_type: 'due_soon' | 'overdue' | 'final_notice';
  scheduled_for: string;
  sent_at?: string;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  email_sent: boolean;
  sms_sent: boolean;
  created_at: string;
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

export interface UpcomingPayment {
  payment_id: string;
  contract_id: string;
  client_name: string;
  client_email: string;
  payment_type: string;
  amount: number;
  due_date: string;
  days_until_due: number;
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

export class PaymentScheduleService {
  /**
   * Create a payment schedule for a contract
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
   * Get upcoming payments (next X days)
   */
  async getUpcomingPayments(daysAhead: number = 7): Promise<UpcomingPayment[]> {
    console.log('📅 Getting upcoming payments for next', daysAhead, 'days');

    const { data, error } = await supabase.rpc('get_upcoming_payments', {
      days_ahead: daysAhead
    });

    if (error) {
      console.error('❌ Error getting upcoming payments:', error);
      throw new Error(`Failed to get upcoming payments: ${error.message}`);
    }

    return data as UpcomingPayment[];
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
   * Get all payments for a contract
   */
  async getContractPayments(contractId: string): Promise<PaymentRecord[]> {
    console.log('💳 Getting payments for contract:', contractId);

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
   * Update payment status
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
   * Create a payment reminder
   */
  async createPaymentReminder(
    paymentId: string,
    reminderType: PaymentReminder['reminder_type'],
    scheduledFor: string
  ): Promise<PaymentReminder> {
    console.log('⏰ Creating payment reminder for payment:', paymentId);

    const { data, error } = await supabase
      .from('payment_reminders')
      .insert({
        payment_id: paymentId,
        reminder_type: reminderType,
        scheduled_for: scheduledFor,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating payment reminder:', error);
      throw new Error(`Failed to create payment reminder: ${error.message}`);
    }

    console.log('✅ Payment reminder created successfully');
    return data as PaymentReminder;
  }

  /**
   * Mark reminder as sent
   */
  async markReminderSent(
    reminderId: string,
    emailSent: boolean = true,
    smsSent: boolean = false
  ): Promise<PaymentReminder> {
    console.log('📧 Marking reminder as sent:', reminderId);

    const { data, error } = await supabase
      .from('payment_reminders')
      .update({
        sent_at: new Date().toISOString(),
        status: 'sent',
        email_sent: emailSent,
        sms_sent: smsSent
      })
      .eq('id', reminderId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error marking reminder as sent:', error);
      throw new Error(`Failed to mark reminder as sent: ${error.message}`);
    }

    console.log('✅ Reminder marked as sent successfully');
    return data as PaymentReminder;
  }

  /**
   * Get payment reminders that need to be sent
   */
  async getPendingReminders(): Promise<PaymentReminder[]> {
    console.log('⏰ Getting pending payment reminders');

    const { data, error } = await supabase
      .from('payment_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString())
      .order('scheduled_for', { ascending: true });

    if (error) {
      console.error('❌ Error getting pending reminders:', error);
      throw new Error(`Failed to get pending reminders: ${error.message}`);
    }

    return data as PaymentReminder[];
  }

  /**
   * Create a manual payment record
   */
  async createManualPayment(
    contractId: string,
    amount: number,
    paymentType: PaymentRecord['payment_type'],
    dueDate?: string,
    notes?: string
  ): Promise<PaymentRecord> {
    console.log('💳 Creating manual payment for contract:', contractId);

    const { data, error } = await supabase
      .from('contract_payments')
      .insert({
        contract_id: contractId,
        payment_type: paymentType,
        amount: amount,
        due_date: dueDate || new Date().toISOString().split('T')[0],
        payment_number: 1,
        total_payments: 1,
        status: 'pending',
        notes: notes
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creating manual payment:', error);
      throw new Error(`Failed to create manual payment: ${error.message}`);
    }

    console.log('✅ Manual payment created successfully');
    return data as PaymentRecord;
  }
}
