"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentScheduleService = void 0;
const supabase_1 = __importDefault(require("../supabase"));
class PaymentScheduleService {
    /**
     * Create a payment schedule for a contract
     */
    async createPaymentSchedule(request) {
        console.log('📅 Creating payment schedule for contract:', request.contract_id);
        const { data, error } = await supabase_1.default.rpc('create_payment_schedule', {
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
    async getPaymentSummary(contractId) {
        console.log('💰 Getting payment summary for contract:', contractId);
        const { data, error } = await supabase_1.default.rpc('get_contract_payment_summary', {
            p_contract_id: contractId
        });
        if (error) {
            console.error('❌ Error getting payment summary:', error);
            throw new Error(`Failed to get payment summary: ${error.message}`);
        }
        return data[0];
    }
    /**
     * Get all overdue payments
     */
    async getOverduePayments() {
        console.log('⚠️ Getting overdue payments');
        const { data, error } = await supabase_1.default.rpc('get_overdue_payments');
        if (error) {
            console.error('❌ Error getting overdue payments:', error);
            throw new Error(`Failed to get overdue payments: ${error.message}`);
        }
        return data;
    }
    /**
     * Get upcoming payments (next X days)
     */
    async getUpcomingPayments(daysAhead = 7) {
        console.log('📅 Getting upcoming payments for next', daysAhead, 'days');
        const { data, error } = await supabase_1.default.rpc('get_upcoming_payments', {
            days_ahead: daysAhead
        });
        if (error) {
            console.error('❌ Error getting upcoming payments:', error);
            throw new Error(`Failed to get upcoming payments: ${error.message}`);
        }
        return data;
    }
    /**
     * Get payment dashboard data
     */
    async getPaymentDashboard() {
        console.log('📊 Getting payment dashboard data');
        const { data, error } = await supabase_1.default
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
    async getPaymentSchedule(contractId) {
        console.log('📅 Getting payment schedule for contract:', contractId);
        const { data, error } = await supabase_1.default
            .from('payment_schedules')
            .select('*')
            .eq('contract_id', contractId)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('❌ Error getting payment schedule:', error);
            throw new Error(`Failed to get payment schedule: ${error.message}`);
        }
        return data;
    }
    /**
     * Get all payments for a contract
     */
    async getContractPayments(contractId) {
        console.log('💳 Getting payments for contract:', contractId);
        const { data, error } = await supabase_1.default
            .from('contract_payments')
            .select('*')
            .eq('contract_id', contractId)
            .order('due_date', { ascending: true });
        if (error) {
            console.error('❌ Error getting contract payments:', error);
            throw new Error(`Failed to get contract payments: ${error.message}`);
        }
        return data;
    }
    /**
     * Update payment status
     */
    async updatePaymentStatus(paymentId, status, stripePaymentIntentId, notes) {
        console.log('🔄 Updating payment status:', paymentId, 'to', status);
        const updateData = {
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
        const { data, error } = await supabase_1.default
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
        return data;
    }
    /**
     * Create a payment reminder
     */
    async createPaymentReminder(paymentId, reminderType, scheduledFor) {
        console.log('⏰ Creating payment reminder for payment:', paymentId);
        const { data, error } = await supabase_1.default
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
        return data;
    }
    /**
     * Mark reminder as sent
     */
    async markReminderSent(reminderId, emailSent = true, smsSent = false) {
        console.log('📧 Marking reminder as sent:', reminderId);
        const { data, error } = await supabase_1.default
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
        return data;
    }
    /**
     * Get payment reminders that need to be sent
     */
    async getPendingReminders() {
        console.log('⏰ Getting pending payment reminders');
        const { data, error } = await supabase_1.default
            .from('payment_reminders')
            .select('*')
            .eq('status', 'pending')
            .lte('scheduled_for', new Date().toISOString())
            .order('scheduled_for', { ascending: true });
        if (error) {
            console.error('❌ Error getting pending reminders:', error);
            throw new Error(`Failed to get pending reminders: ${error.message}`);
        }
        return data;
    }
    /**
     * Create a manual payment record
     */
    async createManualPayment(contractId, amount, paymentType, dueDate, notes) {
        console.log('💳 Creating manual payment for contract:', contractId);
        const { data, error } = await supabase_1.default
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
        return data;
    }
}
exports.PaymentScheduleService = PaymentScheduleService;
