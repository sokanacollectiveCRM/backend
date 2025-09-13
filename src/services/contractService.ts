import supabase from '../supabase';

export interface ContractData {
  totalHours: string;
  hourlyRateFee: string;
  serviceDeposit: string;
  overnightFeeAmount: string;
  totalAmount: string;
  clientName: string;
  clientInitials: string;
  date: string;
}

export interface ContractRecord {
  id: string;
  signnow_document_id: string;
  client_email: string;
  client_name: string;
  contract_data: ContractData;
  deposit_amount: number;
  total_amount: number;
  status: 'pending' | 'signed' | 'payment_completed' | 'completed';
  created_at: string;
  updated_at: string;
  signed_at?: string;
  payment_completed_at?: string;
}

export class ContractService {
  /**
   * Save contract data when document is uploaded to SignNow
   */
  async saveContract(
    signnowDocumentId: string,
    clientEmail: string,
    clientName: string,
    contractData: ContractData
  ): Promise<ContractRecord> {
    console.log('💾 Saving contract data:', {
      signnowDocumentId,
      clientEmail,
      clientName,
      contractData
    });

    const { data, error } = await supabase
      .from('contracts')
      .insert({
        signnow_document_id: signnowDocumentId,
        client_email: clientEmail,
        client_name: clientName,
        contract_data: contractData,
        deposit_amount: parseFloat(contractData.serviceDeposit),
        total_amount: parseFloat(contractData.totalAmount),
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error saving contract:', error);
      throw new Error(`Failed to save contract: ${error.message}`);
    }

    console.log('✅ Contract saved successfully:', data);
    return data as ContractRecord;
  }

  /**
   * Get contract by SignNow document ID
   */
  async getContractBySignNowId(signnowDocumentId: string): Promise<ContractRecord | null> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('signnow_document_id', signnowDocumentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('❌ Error fetching contract:', error);
      throw new Error(`Failed to fetch contract: ${error.message}`);
    }

    return data as ContractRecord;
  }

  /**
   * Get contract by client email
   */
  async getContractByClientEmail(clientEmail: string): Promise<ContractRecord | null> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('client_email', clientEmail)
      .eq('status', 'signed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      console.error('❌ Error fetching contract by client email:', error);
      throw new Error(`Failed to fetch contract: ${error.message}`);
    }

    return data as ContractRecord;
  }

  /**
   * Update contract status when signed
   */
  async markContractAsSigned(signnowDocumentId: string): Promise<void> {
    const { error } = await supabase
      .from('contracts')
      .update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('signnow_document_id', signnowDocumentId);

    if (error) {
      console.error('❌ Error updating contract status:', error);
      throw new Error(`Failed to update contract status: ${error.message}`);
    }

    console.log('✅ Contract marked as signed:', signnowDocumentId);
  }

  /**
   * Update contract status when payment is completed
   */
  async markContractPaymentCompleted(signnowDocumentId: string): Promise<void> {
    const { error } = await supabase
      .from('contracts')
      .update({
        status: 'payment_completed',
        payment_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('signnow_document_id', signnowDocumentId);

    if (error) {
      console.error('❌ Error updating contract payment status:', error);
      throw new Error(`Failed to update contract payment status: ${error.message}`);
    }

    console.log('✅ Contract payment marked as completed:', signnowDocumentId);
  }

  /**
   * Save payment record
   */
  async savePayment(
    contractId: string,
    stripePaymentIntentId: string,
    amount: number,
    paymentType: 'deposit' | 'installment' | 'final',
    status: 'pending' | 'succeeded' | 'failed' | 'canceled'
  ): Promise<void> {
    const { error } = await supabase
      .from('contract_payments')
      .insert({
        contract_id: contractId,
        stripe_payment_intent_id: stripePaymentIntentId,
        amount,
        payment_type: paymentType,
        status
      });

    if (error) {
      console.error('❌ Error saving payment:', error);
      throw new Error(`Failed to save payment: ${error.message}`);
    }

    console.log('✅ Payment saved successfully');
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    stripePaymentIntentId: string,
    status: 'succeeded' | 'failed' | 'canceled'
  ): Promise<void> {
    const updateData: any = { status };

    if (status === 'succeeded') {
      updateData.completed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('contract_payments')
      .update(updateData)
      .eq('stripe_payment_intent_id', stripePaymentIntentId);

    if (error) {
      console.error('❌ Error updating payment status:', error);
      throw new Error(`Failed to update payment status: ${error.message}`);
    }

    console.log('✅ Payment status updated:', stripePaymentIntentId, status);
  }
}

export const contractService = new ContractService();
