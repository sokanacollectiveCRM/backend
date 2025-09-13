"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contractService = exports.ContractService = void 0;
const supabase_1 = __importDefault(require("../supabase"));
class ContractService {
    /**
     * Save contract data when document is uploaded to SignNow
     */
    async saveContract(signnowDocumentId, clientEmail, clientName, contractData) {
        console.log('💾 Saving contract data:', {
            signnowDocumentId,
            clientEmail,
            clientName,
            contractData
        });
        const { data, error } = await supabase_1.default
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
        return data;
    }
    /**
     * Get contract by SignNow document ID
     */
    async getContractBySignNowId(signnowDocumentId) {
        const { data, error } = await supabase_1.default
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
        return data;
    }
    /**
     * Get contract by client email
     */
    async getContractByClientEmail(clientEmail) {
        const { data, error } = await supabase_1.default
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
        return data;
    }
    /**
     * Update contract status when signed
     */
    async markContractAsSigned(signnowDocumentId) {
        const { error } = await supabase_1.default
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
    async markContractPaymentCompleted(signnowDocumentId) {
        const { error } = await supabase_1.default
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
    async savePayment(contractId, stripePaymentIntentId, amount, paymentType, status) {
        const { error } = await supabase_1.default
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
    async updatePaymentStatus(stripePaymentIntentId, status) {
        const updateData = { status };
        if (status === 'succeeded') {
            updateData.completed_at = new Date().toISOString();
        }
        const { error } = await supabase_1.default
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
exports.ContractService = ContractService;
exports.contractService = new ContractService();
